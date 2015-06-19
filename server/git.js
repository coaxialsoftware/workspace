/**
 * workspace.git
 *
 * GIT Extension
 */
"use strict";

var
	cxl = require('cxl'),
	fs = require('fs'),

	workspace = require('./workspace'),
	common = require('./common'),
	plugin = module.exports = cxl('workspace.git')
;

plugin.extend({

	onProjectCreate: function(project)
	{
		if (fs.existsSync(project.path+'/.git'))
			project.tags.git = true;
	},

	readIgnore: function(project)
	{
		return common.read(project.path + '/.gitignore')
			.then(function(data) {
				var f = data.trim().split("\n");
				project.ignore = project.ignore.concat(f);
			});
	},

	onProjectLoad: function(project)
	{
		project.resolve(this.readIgnore(project));
	}

}).config(function() {
	workspace.plugins.on('project.create', this.onProjectCreate.bind(this));
	workspace.plugins.on('project.load', this.onProjectLoad.bind(this));
});