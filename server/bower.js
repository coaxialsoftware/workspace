/**
 *
 * workspace.bower
 *
 */
"use strict";

var
	cxl = require('cxl'),

	workspace = require('./workspace'),
	common = require('./common'),

	plugin = module.exports = cxl('workspace.bower')
;

plugin.config(function() {

	workspace.plugins.on('project.create', function(project) {

	var
		pkg = common.load_json_sync(project.path + '/bower.json'),
		config = project.configuration
	;

		if (pkg)
		{
			config.tags.bower = true;
			config.name = config.name || pkg.name;
			config.version = config.version || pkg.version;
			config.description = config.description || pkg.description;
		}

	});

});
