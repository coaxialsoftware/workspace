/**
 *
 * workspace.project Plugin
 *
 */
"use strict";

var
	Q = require('bluebird'),
	cxl = require('cxl'),

	common = require('./common.js'),

	//CONFIG_FILES = /bower\.json|package\.json|project\.json/,

	workspace = require('./workspace')
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
			//git: fs.existsSync(this.path+'/.git'),
			//npm: !!this.package,
			workspace: !!project
		};

		workspace.plugins.emit('project.create', this);
	}

	load()
	{
		this.env = process.env;

		workspace.plugins.emit('project.load', this);
		return Q.resolve(this);
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

module.exports = cxl('workspace.project').config(function() {
	this.server = workspace.server;
	this.projectManager = new ProjectManager();
})

.route('GET', '/project', function(req, res) {

	this.projectManager.load(req.query.n).then(function(result) {
		res.send(result);
	});
});