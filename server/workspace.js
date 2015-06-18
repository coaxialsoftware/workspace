/**
 *
 * workspace Module
 *
 */
"use strict";

var
	EventEmitter = require('events').EventEmitter,
	fs = require('fs'),
	bodyParser = require('body-parser'),

	cxl = require('cxl'),

	common = require('./common.js'),

	basePath = __dirname + '/../',
	workspace = module.exports = cxl('workspace')
;

class Configuration {

	constructor()
	{
		cxl.extend(this, {
			version: '0.1',
			name: 'workspace',
			path: process.cwd(),
			env: process.env,
			user: process.env.USER
		});

		this.loadFile('~/.workspace/config.json');
		this.loadFile('workspace.json');

		if (this.debug)
			cxl.enableDebug();

		var secure = this.secure;

		if (secure)
		{
			this.https = {
				key: fs.readFileSync(secure.key),
				cert: fs.readFileSync(secure.cert)
			};
		}

	}

	/**
	 * Loads a JSON configuration file.
	 */
	loadFile(fn)
	{
		workspace.log('Loading settings from ' + fn);
		common.extend(this, common.load_json_sync(fn));

		return this;
	}
}

cxl.define(Configuration, {

	/**
	 * Enable Debug Mode.
	 */
	debug: false,

	/**
	 * Port to start the server
	 */
	port: 9001,

	/**
	 * Whether or not to use encryption. HTTPS and WSS
	 *
	 * Object containing key and cert filenames.
	 *
	 * @type {object}
	 */
	secure: null

});

/**
 * Plugin Manager
 */
class PluginManager extends EventEmitter {

	constructor()
	{
		super();
		this.plugins = {};
	}

	/**
	 * Registers a plugin
	 *
	 * @param {cxl.Module} cxl Module
	 */
	register(plugin)
	{
		this.plugins[plugin.name] = plugin;
	}

	start()
	{
		for (var i in this.plugins)
			this.plugins[i].start();
	}

}

workspace.extend({

	configuration: new Configuration(),
	plugins: new PluginManager(),

	load: function()
	{
		return this.projectManager.findProjects().bind(this)
			.then(function(projects) {
				return cxl.extend({
					projects: projects,
					files: Object.keys(projects)
				}, this.configuration);
			});
	}

}).config(function()
{
	this.port = this.configuration.port;
	process.title = 'workspace:' + this.port;

	// Register Default Plugins
	this.plugins.register(require('./project'));
	this.plugins.register(require('./file'));
})

.createServer()

.use(bodyParser.json())

.use(cxl.static(basePath + 'public', { maxAge: 86400000 }))

.use(cxl.static(basePath + 'bower_components', { maxAge: 86400000 }))

.run(function() {
	this.plugins.start();
});

