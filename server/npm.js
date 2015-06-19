/**
 *
 * workspace.npm
 *
 */
"use strict";

var
	cxl = require('cxl'),
	_ = require('lodash'),

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
			_.defaults(project, {
				version: pkg.version,
				description: pkg.description
			});
		}

	});

});