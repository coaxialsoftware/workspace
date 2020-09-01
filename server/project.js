/**
 *
 * workspace.project Plugin
 *
 */
'use strict';

const colors = require('colors/safe'),
	plugin = (module.exports = cxl('workspace.project'));
/**
 * Project Configuration (project.json)
 *
 * Avoid using mutable objects as values to speed up diff algorithm.
 */
class ProjectConfiguration extends ide.Configuration {
	constructor(p) {
		var c = ide.configuration;
		super();

		c.exposedSettings.forEach(s => this.$set(s, c[s]));

		this.ignore = [];
		this.$set(c.project);
		this.$set(p);

		this.tags = {
			workspace:
				this.loadFile(this.path + '/project.json') && 'workspace',
		};

		this.loadFile(this.path + '/project.local.json');

		this.icons = [];
	}
}

Object.assign(ProjectConfiguration.prototype, {
	/**
	 * Project name
	 */
	name: null,

	/**
	 * project path and id
	 */
	path: null,

	/**
	 * Project version.
	 */
	version: null,

	/**
	 * Project description.
	 */
	description: null,
});

class ProjectSocketManager {
	constructor(project) {
		this.project = project;
		this.clients = [];
	}

	onMessage(client, data) {
		const project = this.project;

		if (!this.clients.includes(client)) {
			project.log.dbg(`Registering client ${client.id}.`);

			this.clients.push(client);

			client.on('close', this.onSocketClientClose.bind(this, client));

			ide.plugins.emit('project.connect', project, client);

			if (project.ready && data.$ !== project.configuration.$)
				ide.socket.respond(client, 'project', { reload: true });
		}
	}

	onSocketClientClose(client) {
		var i = this.clients.indexOf(client);

		if (i !== -1) {
			this.clients.splice(i, 1);
			this.project.log.dbg(`Closing socket client id: ${client.id}`);
		}
	}

	/**
	 * Calls ide.notify in all clients
	 */
	notify(hint) {
		this.broadcast({ notify: hint });
	}

	/**
	 * Broadcast data to all project clients.
	 */
	broadcast(data, plugin) {
		ide.socket.broadcast(plugin || 'project', data, this.clients);
	}
}

class ProjectFileManager extends ide.FileManager {
	constructor(project) {
		super(project.path);

		if (project.path === '.') this.recursive = false;

		this.project = project;
		this.$ignore = new ide.FileMatcher();
		this.log = project.log;
		this.buildFilesDebounced = cxl.debounce(this.buildFiles, 250);
	}

	onFileChange(ev) {
		this.project.socket.broadcast(
			{
				stat: {
					f: ev.path,
					t: ev.stat && ev.stat.mtime.getTime(),
				},
			},
			'file'
		);

		if (ev.relativePath === 'project.json') this.project.reload();
		// Handle files added
		else if (ev.type !== 'change' || !this.includes(ev.relativePath))
			this.buildFilesDebounced();

		ide.plugins.emit('project.filechange', this.project, ev);
	}

	onFileError(ev) {
		this.log.error(ev.type + ' ' + ev.path);
	}

	onEvent(ev) {
		this.log.dbg(ev.type + ' ' + ev.path);

		if (ev.type === 'error') this.onFileError(ev);
		else this.onFileChange(ev);
	}

	buildFiles() {
		this.log.dbg('Generating Project Files');
		return this.build().then(result => {
			this.project.configuration.set(
				'files',
				cxl.sortBy(result, 'filename')
			);
		});
	}

	buildIgnore() {
		this.log.dbg('Generating Ignore Regex');
		this.$ignore.push(
			this.project.configuration.ignore || [
				'**/.*',
				'node_modules',
				'bower_components',
			]
		);
		// TODO See if we can remove this
		try {
			const regex = this.$ignore.build();
			this.project.configuration.$set('ignore.regex', regex);
		} catch (e) {
			this.error(e);
		}
	}

	ignore(pattern) {
		this.$ignore.push(pattern);
	}

	load() {
		if (this.project.path === '.') return;

		this.buildIgnore();
		return this.buildFiles();
	}
}

class ThemeManager {
	constructor(project) {
		this.project = project;
	}

	onThemeReload(theme) {
		this.project.configuration.set('theme.css', theme.source);
	}

	loadTheme(theme) {
		if (this.listener) this.listener.unsubscribe();

		this.theme = theme;
		this.listener = ide.plugins.on(
			'themes.reload:' + theme.path,
			this.onThemeReload,
			this
		);
		this.onThemeReload(theme);
	}

	load() {
		const config = this.project.configuration;

		if (config.theme)
			return ide.themes
				.load(config.theme)
				.then(theme => this.loadTheme(theme));
	}
}

/**
 * Manages Project
 *
 * Events Emitted:
 * - project.create
 * - project.load
 * - project.ready
 */
class Project {
	constructor(path) {
		this.path = path;

		this.log = new cxl.Logger(
			colors.green('workspace.project') + ` ${colors.yellow(this.path)}`
		);

		ide.plugins.on('workspace.reload', this.reload.bind(this));

		this.create();
	}

	create() {
		this.configuration = new ProjectConfiguration({
			path: this.path,
			onUpdate: cxl.debounce(() => {
				if (this.loaded) this.socket.broadcast({ reload: true });
			}, 100),
		});

		this.loaded = false;
		this.ready = false;

		ide.plugins.emit('project.create', this, this.configuration);

		return this;
	}

	/**
	 * workspace.exec in project context
	 */
	exec(command, options) {
		return ide.exec(
			command,
			Object.assign(
				{
					cwd: this.path,
				},
				options
			)
		);
	}

	/**
	 * Adds promises to be resolved on Project load.
	 */
	resolve(promise) {
		if (this.loaded)
			throw new Error(
				'Cannot add resolves because project is already loaded.'
			);

		this.promises.push(promise.catch(err => this.log.error(err)));
	}

	reload() {
		const loaded = this.loaded;

		this.create();

		if (loaded) {
			this.log('Reloading project.');
			this.destroy();
			this.doLoad();
		}
	}

	doLoad(full) {
		// Delay the most time consuming tasks
		const onTimeout = () =>
			Promise.all([this.files.load(), this.theme.load()]).then(() => {
				ide.plugins.emit('project.ready', this);
				this.ready = true;
			});

		// Object used by plugins to store data.
		this.data = {};
		this.promises = [];

		ide.plugins.emit('project.load', this);

		return Promise.all(this.promises)
			.then(() => {
				this.loaded = true;
				delete this.promises;

				return full ? onTimeout() : setImmediate(onTimeout);
			})
			.then(() => this.configuration);
	}

	/**
	 * Loads project. It should only run once, unlike doLoad()
	 */
	load(full) {
		if (this.loaded) return Promise.resolve(this.configuration);

		// Temporary Resources. Will be destroyed on project reload.
		this.resources = new ide.ResourceManager();
		this.socket = new ProjectSocketManager(this);
		this.files = new ProjectFileManager(this);
		this.theme = new ThemeManager(this);

		return this.doLoad(full);
	}

	toJSON() {
		return this.configuration;
	}

	destroy() {
		this.resources.destroy();
	}
}

class ProjectManager {
	constructor() {
		this.path = '.';
		ide.plugins.on('project.filechange', this.onFileChange.bind(this));
		this.projects = {};
	}

	onFileChange(project) {
		if (project.path === '.') this.findProjects();
	}

	getProjectByName(name) {
		for (var i in this.projects)
			if (this.projects[i].configuration.name === name)
				return this.projects[i];
	}

	getProject(path) {
		if (!path || path === '.') return this.workspaceProject;

		return this.projects[path] || (this.projects[path] = new Project(path));
	}

	load(path, full) {
		path = path || '.';
		return cxl.file
			.stat(path)
			.catch(e => {
				var p = this.getProjectByName(path);
				return p ? (path = p.path) : Promise.reject(e);
			})
			.then(() => {
				return this.getProject(path).load(full);
			});
	}

	getProjectInformation(path) {
		// TODO better directory mime?
		if (
			path.mime !== 'text/directory' ||
			path.filename.indexOf('.') === 0 ||
			path.filename === 'node_modules'
		)
			return;

		if (this.projects[path.filename]) return this.projects[path.filename];

		this.projects[path.filename] = new Project(path.filename);
	}

	findProjects() {
		const p = (this.workspaceProject = new Project('.'));
		p.load();

		this.workspaceProject.log.dbg('Building project list');

		return ide.File.list(this.path)
			.then(list => {
				list.forEach(this.getProjectInformation.bind(this));
			})
			.then(() => {
				var projects = Object.assign({}, this.projects);
				delete projects['.'];
				return projects;
			});
	}
}

plugin
	.extend({
		onMessage(client, data) {
			if (!data.path) return;

			const project = this.projectManager.getProject(data.path);

			project.load(data.path).then(function () {
				project.socket.onMessage(client, data);
			});
		},

		onAssistInline(request) {
			var projects = this.projectManager.projects,
				token = request.features.token,
				i,
				p,
				result,
				term;
			if (token && token.type === 'project' && projects) {
				term = token.value;
				result = [];

				for (p in projects) {
					i = p.indexOf(term);

					if (i !== -1)
						result.push({
							priority: i,
							title: p,
							icon: 'project',
							matchStart: i,
							matchEnd: i + term.length,
						});
				}

				request.respondInline(result);
			}
		},

		onLoad() {
			this.projectManager.findProjects();
		},
	})
	.config(function () {
		this.server = cxl('workspace').server;
	})
	.run(function () {
		ide.projectManager = this.projectManager = new ProjectManager();
		ide.plugins.on('socket.message.project', this.onMessage.bind(this));

		ide.plugins.on('assist', this.onAssistInline.bind(this));
		ide.plugins.on('workspace.load', this.onLoad.bind(this));
	})
	.route('GET', '/projects', function (req, res) {
		ide.ServerResponse.respond(
			res,
			this.projectManager.findProjects(),
			this
		);
	})
	.route('GET', '/project', function (req, res) {
		ide.ServerResponse.respond(
			res,
			this.projectManager.load(req.query.n, req.query.full),
			this
		);
	})
	.route('POST', '/project', function (req, res) {
		// Create project ?
		var p = req.body.path;
		ide.ServerResponse.respond(res, cxl.file.mkdir(p), this);
	});
