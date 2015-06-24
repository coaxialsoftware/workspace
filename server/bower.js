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

		var pkg = common.load_json_sync(project.path + '/bower.json');

		if (pkg)
		{
			project.tags.bower = true;
			project.name = project.name || pkg.name;
			project.version = project.version || pkg.version;
			project.description = project.description || pkg.description;
		}

	});

});