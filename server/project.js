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

	common = require('./common.js'),

	//CONFIG_FILES = /bower\.json|package\.json|project\.json/,

	workspace = require('./workspace'),
	chokidar = require('chokidar'),

	plugin = module.exports = cxl('workspace.project')
;

class Project {

	constructor(path)
	{
		var project = common.load_json_sync(path+'/project.json');

		this.path = path;

		cxl.extend(this, workspace.configuration.project_defaults, project);

		this.tags = {
			workspace: !!project
		};

		Object.defineProperty(this, 'clients', {
			value: [], enumerable: false });

		workspace.plugins.emit('project.create', this);

		if (!this.name)
			this.name = this.path;
	}

	resolve(promise)
	{
		var p = this.promises || (this.promises = []);

		p.push(promise);
	}

	generateIgnore()
	{
		var ignore = this.ignore = _.uniq(this.ignore);
		this.ignoreMatcher = function(path) {
			return micromatch.any(path, ignore);
		};
	}

	log(msg)
	{
		plugin.log(`${colors.yellow(this.path)} ${msg}`);
	}

	rebuildFiles()
	{
	var
		me = this, time = Date.now()
	;
		me.watcher.rebuilding = true;

		common.walk(this.path, this.ignoreMatcher, function(err, result) {
			me.watcher.rebuilding = false;

			if (err)
				return plugin.error(err);

			me.log(`${result.length} file(s) found (${Date.now()-time} ms).`);
			me.files = _.sortBy(result, 'filename');
			me.broadcast();
		});
	}

	getPayload()
	{
		return JSON.stringify({
			plugin: 'project',
			data: {
				files: this.files
			}
		});
	}

	broadcast()
	{
		var me = this;
		this.clients.forEach(function(client) {
			client.send(me.getPayload());
		});
	}

	onMessage(client)
	{
		if (this.clients.indexOf(client)===-1)
		{
			this.log(`Registering client ${client.id}.`);
			this.clients.push(client);
			client.send(this.getPayload());
		}
	}

	onWatch(ev, path)
	{
		if (ev!=='change' && !this.watcher.rebuilding)
			this.rebuildFiles();

		this.log(ev + ' ' + path);
	}

	onTimeout()
	{
		this.generateIgnore();

		if (!this.watcher)
		{
			this.watcher = chokidar.watch(this.path, {
				ignored: this.ignore,
				followSymlinks: false,
				ignoreInitial: true,
				cwd: this.path
			});
			this.watcher.on('all', this.onWatch.bind(this));
			Object.defineProperty(this, 'watcher', { enumerable: false });
		}

		this.rebuildFiles();
	}

	onResolved()
	{
		setImmediate(this.onTimeout.bind(this));

		this.loaded = true;

		delete this.promises;

		return this;
	}

	onLoadFail(err)
	{
		return Q.reject(err);
	}

	load()
	{
		if (this.loaded)
			return Q.resolve(this);

		this.log('Loading.');

		this.env = process.env;

		// Make sure project exists.
		this.resolve(common.stat(this.path));

		workspace.plugins.emit('project.load', this);

		return Q.all(this.promises).bind(this).then(this.onResolved, this.onLoadFail);
	}
}

cxl.define(Project, {

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

	/**
	 * Files ignored by the project.
	 */
	ignore: [ '.*', 'node_modules', 'bower_modules' ]

});

class ProjectManager {

	constructor()
	{
		/**
		* List of projects
		*/
		this.projects = {};
		this.path = '.';
	}

	loadProject(path)
	{
		return (this.projects[path] ||
			(this.projects[path] = new Project(path))).load();
	}

	loadAll()
	{
		return this.findProjects().then(function(projects) {
				return cxl.extend({
					projects: projects,
					files: Object.keys(projects)
				}, workspace.configuration);
			});
	}

	load(path)
	{
		return path ? this.loadProject(path) : this.loadAll();
	}

	getProjectInformation(path)
	{
		if (!common.isDirectory(path))
			return;

		this.projects[path] = new Project(path);
	}

	findProjects()
	{
	 return common.readDirectory(this.path)
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
		var project = this.projectManager.projects[data.project];

		if (project)
			project.onMessage(client, data);
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