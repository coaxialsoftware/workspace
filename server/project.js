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
		// TODO See if we can make this safer.
		var project = common.load_json_sync(path+'/project.json');

		this.path = path;

		cxl.extend(this, workspace.configuration.project_defaults, project);

		//bower: common.load_json_sync(path+'/bower.json'),
		//package: common.load_json_sync(path+'/package.json'),
		this.tags = {
			//npm: !!this.package,
			workspace: !!project
		};

		Object.defineProperty(this, 'clients', {
			value: [], enumerable: false });

		workspace.plugins.emit('project.create', this);
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
		me.log('Building file list.');

		common.walk(this.path, this.ignoreMatcher, function(err, result) {
			if (err)
				return plugin.error(err);

			me.log(`${result.length} file(s) found (${Date.now()-time} ms).`);
			me.files = result;
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
		if (ev!=='change')
			this.rebuildFiles();

		this.log(ev + ' ' + path);
	}

	onTimeout()
	{
		if (!this.watcher)
		{
			this.log(`Watching ${this.path}`);
			this.watcher = chokidar.watch(this.path, {
				//ignored: this.ignoreRegex,
				followSymlinks: false,
				ignoreInitial: true
			});
			this.watcher.on('all', this.onWatch.bind(this));
			Object.defineProperty(this, 'watcher', { enumerable: false });
		}

		this.generateIgnore();
		this.rebuildFiles();
	}

	onResolved()
	{
		setImmediate(this.onTimeout.bind(this));

		delete this.promises;

		return this;
	}

	load()
	{
		this.log('Loading');

		if (this.loaded)
			return Q.resolve(this);

		if (!this.ignore)
			this.ignore = [ '.*', 'node_modules', 'bower_modules' ];

		this.env = process.env;

		workspace.plugins.emit('project.load', this);

		this.loaded = true;

		return this.promises ? Q.all(this.promises)
			.bind(this).then(this.onResolved) :
			Q.resolve(this.onResolved());
	}
}

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
		return this.findProjects().bind(this)
			.then(function(projects) {
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
		this.projectManager.projects[data.project].onMessage(client, data);
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
	});
});