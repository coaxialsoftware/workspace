/**
 *
 * workspace.project Plugin
 *
 */
"use strict";

var
	Q = require('bluebird'),
	cxl = require('cxl'),
	_ = require('lodash'),
	colors = require('colors'),
	micromatch = require('micromatch'),
	path = require('path'),

	common = require('./common'),
	workspace = require('./workspace'),
	Watcher = require('./watcher'),

	plugin = module.exports = cxl('workspace.project')
;

/**
 * Project Configuration (project.json)
 * 
 * Avoid using mutable objects as values to speed up diff algorithm.
 *
 */
function ProjectConfiguration(path) {
	var project = common.load_json_sync(path+'/project.json');
	
	// TODO ?
	common.extend(this, workspace.configuration.project);
	common.extend(this, project);
	
	this.path = path;
	
	if (!this.ignore)
		// TODO better default?
		this.ignore = [ '**/.*', 'node_modules', 'bower_components' ];
	
	_.defaults(this, _.pick(workspace.configuration,
		['keymap', 'theme']));
	
	this.buildSources();
	
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
	description: null,
	
	buildSources()
	{
		if (this.plugins)
			this.src = this.plugins.map(function(p) {
				return workspace.plugins.sources[p] ||
					workspace.plugins.sources['workspace.'+p];
			}, this).join('');
	}
	
});

class Project {

	constructor(path)
	{
		this.path = path;
		this.clients = [];
		this.create();
		
		workspace.plugins.on('workspace.reload', this.reload.bind(this));
	}
	
	create()
	{
	var
		config = this.configuration = new ProjectConfiguration(this.path)
	;
		workspace.plugins.emit('project.create', this);
		
		if (!config.name)
			config.name = config.path;
		
		return this;
	}

	resolve(promise)
	{
		var p = this.promises || (this.promises = []);

		p.push(promise);
	}

	generateIgnore()
	{
	var
		ignore = this.configuration.ignore = _.uniq(this.configuration.ignore)
	;		
		this.configuration['ignore.regex'] = '^' + _.map(ignore, function(glob) {
			try {
				var regex = micromatch.makeRe(glob).source;
				return regex.substr(1, regex.length-2);
			} catch(e) {
				this.error(`Invalid ignore parameter: "${glob}"`);
			}
		}, this).join('|') + '$';
		
		this.ignoreMatcher = function(path) {
			return micromatch.any(path, ignore);
		};
	}

	error(msg)
	{
		plugin.error(`${this.path} ${msg}`);
	}
	
	log(msg)
	{
		plugin.log(`${colors.yellow(this.path)} ${msg}`);
	}
	
	dbg(msg)
	{
		plugin.dbg(`${colors.yellow(this.path)} ${msg}`);
	}

	rebuildFiles()
	{
	var
		me = this, time = Date.now()
	;
		me.rebuilding = true;

		common.walk(this.path, this.ignoreMatcher, function(err, result) {
			me.rebuilding = false;

			if (err)
				return plugin.error(err);

			me.log(`${result.length} file(s) found (${Date.now()-time} ms).`);
			
			me.files = result;
			me.configuration.files = JSON.stringify(_.sortBy(result, 'filename'));
			me.watchFiles();
			me.broadcast({ files: me.configuration.files });
		});
	}

	/**
	 * Broadcast data to all project clients.
	 */
	broadcast(data, plugin)
	{
		workspace.socket.broadcast(plugin || 'project', data, this.clients);
	}
	
	setConfig(attr)
	{
		var diff = common.diff(this.configuration, attr);
		this.broadcast(diff);
		
		this.configuration = attr;
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
	
	onWatch(ev, filepath, full)
	{
		if (ev!=='change')
		{
			if (!this.rebuilding)
				this.rebuildFiles();
		} else 
		{
			common.stat(full).bind(this)
				.then(function(s) {
					this.broadcast({
						stat: { p: full, t: s.mtime.getTime() }
					}, 'file');
				}, function() {
					this.error(`Unable to stat ${full}`);
				});
			
			workspace.plugins.emit('project.filechange', this, ev, filepath);
			workspace.plugins.emit('project.filechange:' + filepath, this, ev, filepath);
			
			if (filepath==='project.json')
				this.reload();
		}
		
		if (filepath===this.themePath)
			this.loadTheme();

		this.dbg(ev + ' ' + filepath);
	}
	
	onWatchError(err)
	{
		this.log(colors.red('watcher: ' + err));
	}
	
	watchFiles()
	{
		var files = _(this.files).filter('directory', true)
			.pluck('filename')
			.value()
		;
		
		if (this.watcher)
			this.watcher.close();
		
		this.dbg(`Creating watcher for ${this.path}`);
		this.watcher = new Watcher({
			base: this.path,
			ignore: this.ignoreMatcher,
			paths: files,
			onEvent: this.onWatch.bind(this)
		});

		if (this.configuration.theme)
			this.watchTheme();
	}

	onTimeout()
	{
		this.generateIgnore();
		this.rebuildFiles();
		
		if (this.configuration.theme)
			this.loadTheme();
	}
	
	watchTheme()
	{
		this.dbg(`Watching theme ${this.themePath}`);
		this.themeId = this.watcher.watchFile(this.themePath);
	}
	
	loadTheme()
	{
	var
		theme = this.configuration.theme,
		file = path.isAbsolute(theme) ? theme :
			workspace.basePath + '/public/theme/' + theme + '.css'
	;
		this.themePath = path.relative(this.path, file);
		this.log(`Loading Theme "${theme}"(${this.themePath})`);
		
		if (this.themeId)
		{
			this.watcher.unwatch(this.themeId);
			this.watchTheme();
		}
		
		common.read(file).bind(this).then(function(data) {
			var css = this.configuration['theme.css'] = data.replace(/\n/g, '');
			this.broadcast({ 'theme.css': css });
		}, this.error);
	}

	onResolved()
	{
		setImmediate(this.onTimeout.bind(this));

		this.loaded = true;

		delete this.promises;

		return this.configuration;
	}

	onLoadFail(err)
	{
		return Q.reject(err);
	}
	
	reload()
	{
		this.log('Reloading project.');
		this.loaded = false;
		this.create().load().then(function(config) {
			this.setConfig(config);
		});
	}

	load()
	{
		if (this.loaded)
			return Q.resolve(this.configuration);

		this.log('Loading.');

		this.configuration.user = process.env.USER || process.env.USERNAME;

		// Make sure project exists.
		this.resolve(common.stat(this.path));

		workspace.plugins.emit('project.load', this);

		return Q.all(this.promises).bind(this).then(this.onResolved, this.onLoadFail);
	}
	
	toJSON()
	{
		return this.configuration;
	}
}

cxl.define(Project, {

	/** @type {ProjectConfiguration} */
	configuration: null,
	
	loaded: false,
	
	watcher: null
	
});

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

	this.projectManager.load(req.query.n).then(function(result) {
		res.send(result);
	}, common.sendError(this, res));
});
