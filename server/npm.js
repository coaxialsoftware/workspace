/**
 *
 * workspace.npm
 *
 */
"use strict";

var
	cxl = require('cxl'),

	workspace = require('./workspace'),
	common = require('./common'),

	plugin = module.exports = cxl('workspace.npm')
;

plugin.config(function() {

	workspace.plugins.on('project.create', function(project) {

		var pkg = common.load_json_sync(project.path + '/package.json');

		if (pkg)
		{
			project.tags.npm = true;
			project.name = project.name || pkg.name;
			project.version = project.version || pkg.version;
			project.description = project.description || pkg.description;
		}

	});

});