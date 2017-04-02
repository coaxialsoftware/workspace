/**
 *
 * workspace.project Plugin
 *
 */
"use strict";

var
	Q = require('bluebird'),
	_ = require('lodash'),
	colors = require('colors/safe'),

	common = require('./common'),
	workspace = require('./workspace'),

	plugin = module.exports = cxl('workspace.project')
;

/**
 * Project Configuration (project.json)
 *
 * Avoid using mutable objects as values to speed up diff algorithm.
 */
class ProjectConfiguration extends workspace.Configuration
{

	constructor(p)
	{
		super(_.pick(workspace.configuration,
			['keymap', 'theme', 'online.url', 'user', 'inspect' ]));

		this.set(workspace.configuration.project);
		this.set(p);

		this['workspace.version'] = workspace.configuration.version;
		this.tags = {
			workspace: this.loadFile(
				this.path + '/project.json') && 'workspace'
		};
		
		this.loadFile(this.path + '/project.local.json');
		
		this.icons = [];
	}

}

cxl.define(ProjectConfiguration, {

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
		this.data = {};
		this.create();
		this.buildFilesDebounced = _.debounce(this.buildFiles, 250);
	}

	create()
	{
		this.configuration = new ProjectConfiguration({
			path: this.path,
			onUpdate: (function() {
				this.broadcast({ reload: true });
			}).bind(this)
		});
		// Object used by plugins to store data.
		this.data = {};
		this.promises = [];
		this.loaded = false;
		this.ready = false;

		workspace.plugins.emit('project.create', this, this.configuration);

		return this;
	}

	/**
	 * workspace.exec in project context
	 */
	exec(command, options)
	{
		return workspace.exec(command, _.extend({
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
		workspace.socket.broadcast(plugin || 'project', data, this.clients);
	}

	onMessage(client, data)
	{
		if (this.clients.indexOf(client)===-1)
		{
			this.log(`Registering client ${client.id}.`);
			this.clients.push(client);

			if (this.ready && data.$ !== this.configuration.$)
				workspace.socket.respond(client, 'project', { reload: true });
		}
	}

	onFileEvent(ev, filepath, full, s)
	{
		if (ev==='change')
		{
			this.broadcast({
				stat: { f: filepath, p: full, t: s.mtime.getTime() }
			}, 'file');

			// TODO see if we need to include full path instead
			workspace.plugins.emit('project.filechange', this, ev, filepath, s);
			workspace.plugins.emit('project.filechange:' + filepath, this, ev, filepath, s);

			if (filepath==='project.json')
				this.reload();
		} else if (ev!=='error')
		{
			this.buildFilesDebounced();
		}

		this.log.dbg(ev + ' ' + filepath);
	}

	onTimeout()
	{
	var
		onReady = function() {
			workspace.plugins.emit('project.ready', this);
			this.ready = true;
		},
		promises = [ ]
	;
		this.buildIgnore();
		promises.push(this.buildFiles());

		if (this.configuration.theme)
			promises.push(workspace.themes.load(this.configuration.theme).bind(this)
				.then(this.loadTheme));

		Q.all(promises).bind(this).then(onReady);
	}

	onThemeReload(theme)
	{
		this.configuration.set('theme.css', theme.source);
	}

	loadTheme(theme)
	{
		if (this.theme)
			this.stopListening(workspace.plugins, 'themes.reload:' + this.theme.name);

		this.log(`Loading Theme "${theme.name}"(${theme.path})`);
		this.theme = theme;
		this.listenTo(workspace.plugins, 'themes.reload:' + this.theme.name,
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
		return this.files.build().bind(this).then(function(result) {
			this.configuration.set('files',
				_.sortBy(result, 'filename'));
		});
	}

	buildSources()
	{
		if (this.configuration.plugins)
		{
			this.log.dbg('Building plugin sources: ' + this.configuration.plugins);
			this.configuration.set('plugins.src',
				workspace.plugins.getSources(this.configuration.plugins));
		}
	}

	hasPlugin(name)
	{
		var p = this.configuration.plugins;

		return p && p.indexOf(name)!==-1;
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
		this.ignore = new common.FileMatcher();
		this.buildSources();

		workspace.plugins.emit('project.load', this);

		return Q.all(this.promises).bind(this).then(this.onResolved);
	}

	loadFiles()
	{
		this.files = new common.FileManager({
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
			return Q.resolve(this.configuration);

		this.log = new cxl.Logger(
			colors.green('workspace.project') +
			` ${colors.yellow(this.path)}`);

		this.log.operation('Loading File Manager', this.loadFiles, this);

		this.listenTo(workspace.plugins, 'workspace.reload', this.reload);
		this.listenTo(workspace.plugins, 'plugins.source', this.buildSources);

		return this.doLoad();
	}

	toJSON()
	{
		return this.configuration;
	}

}

_.extend(Project.prototype, cxl.EventListener);


class ProjectManager {

	constructor()
	{
		/**
		* List of projects
		*/
		var p = this.workspaceProject = new Project('.');
		p.configuration.ignore = 'workspace.json';
		this.files = [];
		this.path = '.';
		this.projects = {};
	}

	getProjectByName(name)
	{
		return _.find(this.projects, ['configuration.name', name]);
	}

	getProject(path)
	{
		if (!path)
			return null;

		return (this.projects[path] ||
			(this.projects[path] = new Project(path)));
	}

	loadProject(path)
	{
		return common.stat(path).bind(this).error(function(e) {
			var p = this.getProjectByName(path);
			return p ? (path = p.path) : Q.reject(e);
		}).then(function() {
			return this.getProject(path).load();
		});
	}

	load(path)
	{
		return path ? this.loadProject(path) : this.workspaceProject.load();
	}

	getProjectInformation(path)
	{
		if (!path.directory || path.filename.indexOf('.')===0)
			return;

		if (this.projects[path.filename])
			return this.projects[path.filename];

		this.files.push(path);
		this.projects[path.filename] = new Project(path.filename);
	}

	findProjects()
	{
		return common.list(this.path)
			.bind(this)
			.each(this.getProjectInformation)
			.then(function() {
				return this.projects;
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
	}
})
.config(function() {
	this.server = workspace.server;
	workspace.projectManager = this.projectManager = new ProjectManager();
})
.run(function() {

	workspace.plugins.on('socket.message.project',
		this.onMessage.bind(this));

})
.route('GET', '/projects', function(req, res) {

	this.projectManager.findProjects().then(function(p) {
		res.send(p);
	}, common.sendError(this, res));

})
.route('GET', '/project', function(req, res) {

	this.projectManager.load(req.query.n).then(function(result) {
		res.send(result);
	}, common.sendError(this, res));
});
