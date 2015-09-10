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
function ProjectConfiguration(path)
{
var
	project = common.load_json_sync(path+'/project.json')
;
	common.extend(this, workspace.configuration.project);
	common.extend(this, project);
	
	_.defaults(this, _.pick(workspace.configuration,
		['keymap', 'theme']));
		
	this.path = path;
	this.tags = {
		workspace: !!project
	};
}

cxl.extend(ProjectConfiguration.prototype, {
	
	/**
	 * Project name
	 */
	name: null,

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
	}
	
	create()
	{
		this.configuration = new ProjectConfiguration(this.path);
		this.promises = [];
		
		workspace.plugins.emit('project.create', this, this.configuration);
		
		return this;
	}

	/**
	 * Adds promises to be resolved on Project load.
	 */
	resolve(promise)
	{
		this.promises.push(promise);
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
			
			workspace.socket.respond(client, 'project', common.diff(data, this.configuration));
		}
	}
	
	onFileEvent(ev, filepath, full)
	{
		if (ev==='change')
		{
			common.stat(full).bind(this)
				.then(function(s) {
					this.broadcast({
						stat: { p: full, t: s.mtime.getTime() }
					}, 'file');
				}, function() {
					this.log.error(`Unable to stat ${full}`);
				});
			
			workspace.plugins.emit('project.filechange', this, ev, filepath);
			workspace.plugins.emit('project.filechange:' + filepath, this, ev, filepath);
			
			if (filepath==='project.json')
				this.reload();
		}

		this.log.dbg(ev + ' ' + filepath);
	}
	
	onTimeout()
	{
		this.buildIgnore();
		this.buildFiles();
		
		if (this.configuration.theme)
			workspace.themes.load(this.configuration.theme).bind(this)
				.then(this.loadTheme);
	}
	
	onThemeReload(theme)
	{
		this.broadcast({ 'theme.css': theme.source });
	}
	
	loadTheme(theme)
	{
		if (this.theme)
			this.stopListening(workspace.plugins, 'themes.reload:' + this.theme.name);
		
		this.log(`Loading Theme "${theme.name}"(${theme.path})`);
		this.theme = theme;
		this.configuration['theme.css'] = theme;
		
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
		this.create().doLoad().then(function() {
			this.broadcast({ reload: true });
		});
	}
	
	buildFiles()
	{
		this.files.ignore = this.ignore.matcher.bind(this.ignore);
		this.files.build().bind(this).then(function(result) {
			this.configuration.files = JSON.stringify(
				_.sortBy(result, 'filename'));
			this.broadcast({ files: this.configuration.files });
		});
	}
	
	buildSources()
	{
		if (this.configuration.plugins)
		{
			this.log.dbg('Building plugin sources');
			this.configuration.src = workspace.plugins.getSources(this.configuration.plugins);
		}
	}
	
	buildIgnore()
	{
		this.ignore = new common.FileMatcher(
			this.configuration.ignore ||
			[ '**/.*', 'node_modules', 'bower_components' ]
		);
		this.configuration['ignore.regex'] = this.ignore;
	}
	
	doLoad()
	{
		this.buildSources();
		
		workspace.plugins.emit('project.load', this);
		
		return Q.all(this.promises).bind(this).then(this.onResolved);
	}
	
	loadFiles()
	{
		this.files = new common.FileManager({
			path: this.path,
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
		this.projects = {};
		this.files = [];
		this.path = '.';
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
		return common.stat(path).bind(this).then(function() {
			return this.getProject(path).load();
		});
	}

	loadAll()
	{
		return this.findProjects().then(function(projects) {
				var result = cxl.extend({
					projects: projects,
					files: JSON.stringify(this.files)
				}, workspace.configuration);
			
				delete result.password;
				return result;
			});
	}

	load(path)
	{
		return path ? this.loadProject(path) : this.loadAll();
	}

	getProjectInformation(path)
	{
		if (!path.directory)
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
	this.projectManager = new ProjectManager();
})
.run(function() {

	workspace.plugins.on('socket.message.project',
		this.onMessage.bind(this));

})
.route('GET', '/project', function(req, res) {

	// TODO Make sure project exists.
	//this.resolve(common.stat(this.path));
	
	this.projectManager.load(req.query.n).then(function(result) {
		res.send(result);
	}, common.sendError(this, res));
});
