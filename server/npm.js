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

	var
		pkg = common.load_json_sync(project.path + '/package.json'),
		config = project.configuration
	;

		if (pkg)
		{
			config.tags.npm = true;
			config.name = config.name || pkg.name;
			config.version = config.version || pkg.version;
			config.description = config.description || pkg.description;
		}

	});

});
