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
	_ = require('lodash'),
	Q = require('bluebird'),

	cxl = require('cxl'),

	common = require('./common.js'),
	Watcher = require('./watcher.js'),

	basePath = path.resolve(__dirname + '/../'),
	workspace = global.workspace = module.exports = cxl('workspace')
;

class Configuration {

	constructor()
	{
		this.loadFile('~/.workspace.json');
		this.loadFile('workspace.json');

		cxl.extend(this, {
			version: '0.3.0',
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

class Plugin {
	
	constructor(path)
	{
		var mod = this.mod = require(path);
		this.id = mod.name.replace(/^workspace\./, '');
		this.path = path;
		this.name = mod.name;
		
		this.ready = Q.props({
			source: mod.source ? _.result(mod, 'source') :
				(mod.sourcePath ? common.read(mod.sourcePath) : ''),
			pkg: common.load_json(path + '/package.json')
		}).bind(this).then(function(data) {
			this.source = data.source;
			this.package = data.pkg;
		}, function(e) {
			this.mod.error(`Failed to load plugin ${this.name}`);
			this.mod.error(e);
		});
		
		workspace.online.watch('/plugins/'+this.id, this.onValue, this);
	}
	
	start()
	{
		this.mod.start();
	}
	
	onValue(data)
	{
		if (data.version !== this.package.version)
			this.mod.dbg(`New version ${data.version} available!`);
	}
}

/**
 * Plugin Manager
 */
class PluginManager extends EventEmitter {

	constructor()
	{
		super();
		
		this.plugins = {};
		this.sources = {};		
	}

	/**
	 * Registers a plugin
	 *
	 * @param {cxl.Module} cxl Module
	 */
	register(plugin)
	{
		if (plugin.id in this.plugins)
			workspace.log(`WARNING Plugin ${plugin.name} already registered.`);
						  
		this.plugins[plugin.id] = plugin;
		
		return this;
	}
	
	requireFile(file)
	{
		var plugin = new Plugin(file);

		this.register(plugin);
		
		return plugin;
	}
	
	requirePlugins(plugins)
	{
		_.each(plugins, this.requirePlugin, this);
	}
	
	requirePlugin(name)
	{
	var
		parsed = /^(?:(\w+):)?(.+)/.exec(name)
	;
		if (parsed[1]==='file')
			return this.requireFile(path.resolve(parsed[2]));
		
		return this.requireFile(this.path + '/' + name);
	}
	
	getPackages()
	{
		return _.mapValues(this.plugins, 'package');
	}

	start()
	{
	var
		plugins = workspace.configuration.plugins
	;
		this.path = workspace.configuration['plugins.path'] ||
			(basePath + '/plugins');
		this.package = workspace.data('plugins');
		this.requirePlugins(plugins);
		
		Q.all(_.pluck(this.plugins, 'ready')).bind(this).then(function() {
			this.sources = _.transform(this.plugins, function(result, n, k) {
				result[k] = n.source;
			});
			
			for (var i in this.plugins)
				this.plugins[i].start();
			
			setImmediate(this.emit.bind(this, 'workspace.load', workspace));
		});
	}

}

workspace.extend({

	configuration: new Configuration(),
	plugins: new PluginManager(),
	basePath: basePath,
	common: common,

	_: _,
	Q: Q,
	
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
		onEvent: this.onWatch.bind(this)
	});

	common.stat('workspace.json')
		.then(this.watcher.watchFile.bind(this.watcher, 'workspace.json'),
			this.log.bind(this, 'No workspace.json found.'));
	
	this.__data = common.load_json_sync(this.__dataFile) || {};
	
	process.title = 'workspace:' + this.port;
})

.createServer()

.use(compression())

.use(cxl.static(basePath + '/public', { maxAge: 86400000 }))

.use(cxl.static(basePath + '/node_modules', { maxAge: 86400000 }))

.use(bodyParser.json({ limit: Infinity }))

.route('GET', '/plugins', function(req, res) {
	res.send(this.plugins.getPackages());
})

.run(function() {
	require('./socket').start();
	require('./online').start();
	require('./project').start();
	require('./file').start();
	
	this.plugins.start();
});

