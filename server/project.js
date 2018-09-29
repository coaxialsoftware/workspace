/**
 *
 * workspace.project Plugin
 *
 */
"use strict";

var
	colors = require('colors/safe'),
	path = require('path'),

	plugin = module.exports = cxl('workspace.project')
;

/**
 * Project Configuration (project.json)
 *
 * Avoid using mutable objects as values to speed up diff algorithm.
 */
class ProjectConfiguration extends ide.Configuration
{
	constructor(p)
	{
		var c = ide.configuration;

		super({
			keymap: c.keymap,
			theme: c.theme,
			'debug.inspect': c['debug.inspect'],
			'path.separator': c['path.separator'],
			'editor.encoding': c['editor.encoding'],
			'help.url': c['help.url'],
			'workspace.version': c.version
		});

		this.ignore = [];
		this.set(c.project);
		this.set(p);

		this.tags = {
			workspace: this.loadFile(
				this.path + '/project.json') && 'workspace'
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
	description: null

});

class Project {

	constructor(path)
	{
		this.path = path;
		this.clients = [];
		this.create();
		this.buildFilesDebounced = cxl.debounce(this.buildFiles, 250);
	}

	create()
	{
		this.configuration = new ProjectConfiguration({
			path: this.path,
			onUpdate: cxl.debounce(() => {
				if (this.loaded)
					this.broadcast({ reload: true });
			}, 100)
		});
		// Object used by plugins to store data.
		this.data = {};
		this.promises = [];
		this.loaded = false;
		this.ready = false;
		this.fullPath = path.resolve(this.path);

		ide.plugins.emit('project.create', this, this.configuration);

		return this;
	}

	/**
	 * workspace.exec in project context
	 */
	exec(command, options)
	{
		return ide.exec(command, Object.assign({
			cwd: this.path
		}, options));
	}

	/**
	 * Adds promises to be resolved on Project load.
	 */
	resolve(promise)
	{
		this.promises.push(promise);
	}

	/**
	 * Calls ide.notify in all clients
	 */
	notify(hint)
	{
		this.broadcast({ notify: hint });
	}

	/**
	 * Broadcast data to all project clients.
	 */
	broadcast(data, plugin)
	{
		ide.socket.broadcast(plugin || 'project', data, this.clients);
	}

	onSocketClientClose(client)
	{
		var i = this.clients.indexOf(client);

		if (i!==-1)
		{
			this.clients.splice(i, 1);
			this.log.dbg(`Closing socket client id: ${client.id}`);
		}
	}

	onMessage(client, data)
	{
		if (this.clients.indexOf(client)===-1)
		{
			this.log(`Registering client ${client.id}.`);
			this.clients.push(client);

			client.on('close', this.onSocketClientClose.bind(this, client));

			if (this.ready && data.$ !== this.configuration.$)
				ide.socket.respond(client, 'project', { reload: true });
		}
	}

	onFileEvent(ev)
	{
		if (ev.type==='change')
		{
			this.broadcast({
				stat: {
					f: ev.filename, p: ev.fullpath, t: ev.stat.mtime.getTime(),
					d: path.dirname(ev.filename)
				}
			}, 'file');

			// TODO see if we need to include full path instead
			ide.plugins.emit('project.filechange', this, ev);
			ide.plugins.emit('project.filechange:' + ev.filename, this, ev);

			if (ev.filename==='project.json')
				this.reload();
		} else if (ev.type!=='error')
		{
			this.broadcast({
				stat: {
					f: path.dirname(ev.filename),
					p: path.dirname(ev.fullpath),
					t: ev.stat && ev.stat.mtime.getTime()
				}
			}, 'file');

			this.buildFilesDebounced();
		}

		this.log.dbg(ev.type + ' ' + ev.filename);
	}

	onTimeout()
	{
	var
		onReady = () => {
			ide.plugins.emit('project.ready', this);
			this.ready = true;
		},
		promises = [ ]
	;
		this.buildIgnore();
		promises.push(this.buildFiles());

		if (this.configuration.theme)
			promises.push(ide.themes.load(this.configuration.theme)
				.then(theme => this.loadTheme(theme)));

		Promise.all(promises).then(onReady);
	}

	onThemeReload(theme)
	{
		this.configuration.set('theme.css', theme.source);
	}

	loadTheme(theme)
	{
		if (this.theme)
			this.stopListening(ide.plugins, 'themes.reload:' + this.theme.path);

		this.log(`Loading theme "${theme.path}"`);
		this.theme = theme;
		this.listenTo(ide.plugins, 'themes.reload:' + this.theme.path,
			this.onThemeReload);

		this.onThemeReload(theme);
	}

	onResolved()
	{
		setImmediate(this.onTimeout.bind(this));

		this.loaded = true;

		delete this.promises;

		return this.configuration;
	}

	reload()
	{
		this.log('Reloading project.');
		this.create().doLoad();
	}

	buildFiles()
	{
		this.log.dbg('Generating Project Files');
		this.files.ignore = this.ignore.matcher.bind(this.ignore);
		return this.files.build().then(result => {
			this.configuration.set('files',
				cxl.sortBy(result, 'filename'));
		});
	}

	buildSources()
	{
		this.log.dbg('Building plugin sources: ' + this.configuration.plugins);
		this.configuration.set('plugins.src',
			ide.plugins.getSources(this.configuration.plugins));
	}

	hasPlugin(name)
	{
		return name in ide.plugins.plugins;
	}

	buildIgnore()
	{
		this.log.dbg('Generating Ignore Regex');
		this.ignore.push(
			this.configuration.ignore || [ '**/.*', 'node_modules', 'bower_components' ]);
		this.configuration.set('ignore.regex', this.ignore);
	}

	doLoad()
	{
		this.ignore = new ide.FileMatcher();

		ide.plugins.emit('project.load', this);

		return Promise.all(this.promises).then(this.onResolved.bind(this));
	}

	loadFiles()
	{
		this.files = new ide.FileManager({
			path: this.path,
			recursive: this.path!=='.',
			onEvent: this.onFileEvent.bind(this)
		});
	}

	/**
	 * Loads project. It should only run once, unlike doLoad()
	 */
	load()
	{
		if (this.loaded)
			return Promise.resolve(this.configuration);

		this.log = new cxl.Logger(
			colors.green('workspace.project') +
			` ${colors.yellow(this.path)}`);

		this.log.operation('Loading File Manager', this.loadFiles, this);

		this.listenTo(ide.plugins, 'workspace.reload', this.reload);
		//this.listenTo(workspace.plugins, 'plugins.source', this.buildSources);

		return this.doLoad();
	}

	toJSON()
	{
		return this.configuration;
	}

}

Object.assign(Project.prototype, cxl.EventListener);


class ProjectManager {

	constructor()
	{
		var p = this.workspaceProject = new Project('.');

		// Ignore all files
		p.configuration.ignore = [ '*' ];

		this.path = '.';

		ide.plugins.on('project.filechange', this.onFileChange.bind(this));

		this.projects = {};
	}

	onFileChange(project)
	{
		if (project.path==='.')
			this.findProjects();
	}

	getProjectByName(name)
	{
		for (var i in this.projects)
			if (this.projects[i].configuration.name === name)
				return this.projects[i];
	}

	getProject(path)
	{
		if (!path || path==='.')
			return this.workspaceProject;

		return (this.projects[path] ||
			(this.projects[path] = new Project(path)));
	}

	load(path)
	{
		if (!path || path==='.')
			return this.workspaceProject.load();

		return cxl.file.stat(path).catch(e => {
			var p = this.getProjectByName(path);
			return p ? (path = p.path) : Promise.reject(e);
		}).then(() => {
			return this.getProject(path).load();
		});
	}

	getProjectInformation(path)
	{
		// TODO better directory mime?
		if ((path.mime !== 'text/directory') ||
			path.filename.indexOf('.')===0 || path.filename==='node_modules')
			return;

		if (this.projects[path.filename])
			return this.projects[path.filename];

		this.projects[path.filename] = new Project(path.filename);
	}

	findProjects()
	{
		return ide.File.list(this.path).then(list => {
			list.forEach(this.getProjectInformation.bind(this));
		}).then(() => {
			// TODO Remove '.'
			var projects = Object.assign({}, this.projects);
			delete projects['.'];
			return projects;
		});
	}

}

plugin.extend({

	onMessage: function(client, data)
	{
		if (!data.path)
			return;

		var project = this.projectManager.getProject(data.path);

		project.load(data.path)
			.then(function() {
				project.onMessage(client, data);
			});
	},

	onAssistInline: function(request)
	{
	var
		projects=this.projectManager.projects,
		token = request.features.token,
		i, p, result, term
	;
		if (token && token.type==='project' && projects)
		{
			term = token.value;
			result = [];

			for (p in projects)
			{
				i = p.indexOf(term);

				if (i!==-1)
					result.push({
						priority: i,
						title: p,
						icon: 'project',
						matchStart: i,
						matchEnd: i+term.length
					});
			}

			request.respondInline(result);
		}
	},

	onLoad: function()
	{
		this.projectManager.findProjects();
	}
})
.config(function() {
	this.server = cxl('workspace').server;
})
.run(function() {

	ide.projectManager = this.projectManager = new ProjectManager();
	ide.plugins.on('socket.message.project',
		this.onMessage.bind(this));

	ide.plugins.on('assist', this.onAssistInline.bind(this));
	ide.plugins.on('workspace.load', this.onLoad.bind(this));

})
.route('GET', '/projects', function(req, res) {
	ide.ServerResponse.respond(res, this.projectManager.findProjects(), this);
})
.route('GET', '/project', function(req, res) {
	ide.ServerResponse.respond(res, this.projectManager.load(req.query.n), this);
})
.route('POST', '/project', function(req, res) {
	// Create project ?
	var p = req.body.path;
	ide.ServerResponse.respond(res, cxl.file.mkdir(p), this);
})
;
