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
	compression = require('compression'),
	path = require('path'),

	cxl = require('cxl'),

	common = require('./common.js'),
	Watcher = require('./watcher.js'),

	basePath = path.resolve(__dirname + '/../'),
	workspace = module.exports = cxl('workspace')
;

class Configuration {

	constructor()
	{
		this.loadFile('~/.workspace/config.json');
		this.loadFile('workspace.json');

		cxl.extend(this, {
			version: '0.1',
			user: process.env.USER || process.env.USERNAME
		});

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
		this.path = basePath + '/plugins';
	}

	/**
	 * Registers a plugin
	 *
	 * @param {cxl.Module} cxl Module
	 */
	register(plugin)
	{
		this.plugins[plugin.name] = plugin;
		
		return this;
	}
	
	require(name)
	{
	}

	start()
	{
		var plugins = workspace.configuration.plugins;
		
		this.package = workspace.data('plugins');
		
		for (var i in plugins)
			this.require(i);
		
		setImmediate(this.emit.bind(this, 'workspace.load', workspace));
	}

}

workspace.extend({

	configuration: new Configuration(),
	plugins: new PluginManager(),
	basePath: basePath,
	
	__data: null,
	__dataFile: basePath + '/data.json',
	
	/**
	 * Persist data for plugins.
	 */
	data: function(plugin, data)
	{
		if (arguments.length===1)
			return this.__data[plugin];
		
		this.__data[plugin] = data;
		this.__saveData();
	},
	
	__saveData: function()
	{
		var me = this;
		
		if (this.__dataTimeout)
			clearTimeout(this.__dataTimeout);
		
		this.__dataTimeout = setTimeout(function() {
			me.dbg(`Writing data file. ${me.__dataFile} (${Buffer.byteLength(me.__data)} bytes)`);
			
			common.writeFile(me.__dataFile, JSON.stringify(me.__data));
		});
	},
	
	onWatch: function()
	{
		this.configuration= new Configuration();
		workspace.plugins.emit('workspace.reload');
	}

}).config(function()
{
	this.port = this.configuration.port;
	this.watcher = new Watcher({
		paths: ['workspace.json'],
		onEvent: this.onWatch.bind(this)
	});
	
	this.__data = common.load_json_sync(this.__dataFile) || {};
	
	process.title = 'workspace:' + this.port;
	
	// Register Default Plugins
	this.plugins.register(require('./project'))
		.register(require('./file'))
	//	.register(require('./shell'))
		.register(require('./socket'))
	//	.register(require('./git'))
	//	.register(require('./npm'))
	//	.register(require('./bower'))
	//	.register(require('./plugin.jshint'))
		.register(require('./online'))
	;
	
})

.createServer()

.use(compression())

.use(cxl.static(basePath + '/public', { maxAge: 86400000 }))

.use(cxl.static(basePath + '/node_modules', { maxAge: 86400000 }))

.use(bodyParser.json({ limit: Infinity }))

.run(function() {
	this.plugins.start();
});

