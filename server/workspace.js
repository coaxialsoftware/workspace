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
	npm = require('npm'),

	cxl = require('@cxl/cxl'),

	common = require('./common.js'),
	Watcher = require('./watcher.js'),

	basePath = path.resolve(__dirname + '/../'),
	workspace = global.workspace = module.exports = cxl('workspace')
;

/**
 * Options
 * 
 * onUpdate   Callback function.
 */
class Configuration {

	constructor(defaults)
	{
		var me = this;
		
		me.$ = 0;
		me.update = _.debounce(function() {
			me.$++;
			if (me.onUpdate)
				me.onUpdate();
			return me;
		}, 500);
		
		if (defaults)
			me.set(defaults);
	}
	
	// TODO add checks in debug module
	set(key, value)
	{
		var t = typeof(key);
		
		if (t==='object')
			cxl.extend(this, key);
		else
			this[key] = value;
		
		return this.update(); 
	}
	
	/**
	 * Loads a JSON configuration file.
	 */
	loadFile(fn)
	{
		var obj = common.load_json_sync(fn);
		this.set(obj);
		return obj;
	}
}

class WorkspaceConfiguration extends Configuration {
	
	constructor()
	{
		super();
		
		this.loadFile('~/.workspace.json');
		this.loadFile('workspace.json');

		this.set({
			version: '0.3.0',
			user: process.env.USER || process.env.USERNAME
		});

		if (this.debug)
			cxl.enableDebug();

		var secure = this.secure;

		if (secure)
			this.set('https', {
				key: fs.readFileSync(secure.key),
				cert: fs.readFileSync(secure.cert)
			});
	}
	
}

cxl.define(WorkspaceConfiguration, {
	
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
	secure: null,

	/**
	 * User scripts. Will be added to all projects.
	 */
	scripts: null

});

class Plugin {
	
	constructor(path)
	{
		var mod = this.mod = require(path);
		// TODO ...umm
		this.id = mod.name.replace(/^workspace\./, '')
			.replace(/\./g, '-');
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
		
		if (mod.sourcePath)
			workspace.watch(mod.sourcePath, this.onWatch.bind(this));
		
		workspace.online.watch('/plugins/'+this.id, this.onValue, this);
	}
	
	start()
	{
		this.mod.start();
	}
	
	onWatch(ev, file)
	{
		common.read(file).bind(this).then(function(d) {
			this.source = d;
			workspace.plugins.emit('plugins.source', this.id, this.source);
		}, function() { this.source = ''; });
	}
	
	onValue(data)
	{
		if (!data)
			return this.mod.dbg('Plugin not in main repository.');
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
		try {
			fs.statSync(file);
			var plugin = new Plugin(file);
			this.register(plugin);
			return plugin;
		} catch(e) {
			workspace.error(`Could not load plugin: ${file}`);
		}
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
		
		return this.requireFile(name);
	}
	
	getPackages()
	{
		return _.mapValues(this.plugins, 'package');
	}
	
	loadGlobalPlugins()
	{
		var me = this, regex = /^\@cxl\/workspace\./;
		
		return new Q(function(resolve, reject) {
			npm.load(function(er, npm) {
				npm.config.set("global", true);
				npm.config.set('json', true);
				npm.config.set('depth', 0);
				npm.commands.list(null, true, function(e, data) {
					if (e)
						reject(e);
					
					_.each(data.dependencies, function(d) {
						if (regex.test(d.name))
							me.requireFile(d.realPath);
					});

					resolve(_.pluck(me.plugins, 'ready'));
				});

			});
		});
	}
	
	loadLocalPlugins()
	{
		var plugins = workspace.configuration.plugins;
		this.requirePlugins(plugins);
	}
	
	getSources(plugins)
	{
		var me = this;
		plugins = plugins || _.keys(this.plugins);
		
		return _.reduce(plugins, function(result, n) {
			
			if (n in me.plugins)
				result += me.plugins[n].source;
			else
				workspace.error(`Plugin "${n}" not found.`);
			
			return result;
		}, '') + (this.scripts ? this.scripts : '');
	}
	
	loadScripts(scripts)
	{
		if (!scripts)
			return;
		
		if (typeof(scripts)==='string')
			scripts = [];
		
		this.scripts = '';
		
		scripts.forEach(function(s) {
			try {
				workspace.dbg('Loading script "${e}"');
				this.scripts += fs.readFileSync(s, 'utf8');
				workspace.watch(s, this.onScriptsWatch.bind(this));
			} catch(e) {
				workspace.error('Could not load script "${s}".', e);
			}
		}, this);
		
	}
	
	onScriptsWatch()
	{
		this.loadScripts(workspace.configuration.scripts);
	}
	
	start()
	{
		this.loadLocalPlugins();
		this.loadScripts(workspace.configuration.scripts);
		
		return this.loadGlobalPlugins().all().bind(this).then(function() {

			for (var i in this.plugins)
				this.plugins[i].start();

			setImmediate(
				this.emit.bind(this, 'workspace.load', workspace));
		});
	}

}

class Theme
{
	constructor(p)
	{
		this.name = p;
		this.path = path.isAbsolute(p) ? p :
			basePath + '/public/theme/' + p + '.css';
		this.loaded = false;
		
		workspace.watch(this.path, this.onWatch.bind(this));
	}
	
	onWatch()
	{
		this.load().then(function() {
			workspace.plugins.emit('themes.reload:' + this.name, this);
		});
	}
	
	toJSON()
	{
		return this.source;
	}
	
	load()
	{
		return common.read(this.path).bind(this).then(function(src)
		{
			this.loaded = true;
			this.source = src.replace(/\n/g,'');
			
			return this;
		});
	}
	
}

class ThemeManager
{
	constructor()
	{
		this.themes = {};
	}
	
	load(path)
	{
		var theme = this.themes[path] || (this.themes[path]=new Theme(path));
		return theme.loaded ? Q.resolve(theme) : theme.load();
	}
	
}

workspace.extend({
	
	Configuration: Configuration,

	configuration: new WorkspaceConfiguration(),
	
	plugins: new PluginManager(),
	themes: new ThemeManager(),
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
	
	shell: function(command, params, cwd, res)
	{
		var me = this;
		
		this.log(command + (params ? ' ' + params.join(' ') : ''));

		var process = require('child_process').spawn(
			command, params,
			{ cwd: cwd, detached: true, stdio: [ 'ignore' ] }
		);
		process.on('error', this.error.bind(this.log));
		process.on('close', function(code) {
			me.log(command + ' returned with status ' + code);
			
			if (res)
				res.end();
		});
		
		if (res)
		{
			process.stdout.on('data', function(data) {
				if (!res.headersSent)
					res.writeHead(200);
				res.write(data);
			});
			process.stderr.on('data', function(data) {
				if (!res.headersSent)
					res.writeHead(500);
				res.write(data);
			});
		}
		
		process.unref();
		
		return process;
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
	
	watch: function(path, cb)
	{
		this.dbg(`Watching File ${path}`);
		this.watcher.watchFile(path);

		if (cb)
			this.plugins.on('workspace.watch:' + path, cb);
	},
	
	onWatch: function(ev, file)
	{
		if (file==='workspace.json')
		{
			this.configuration = new WorkspaceConfiguration();
			workspace.plugins.emit('workspace.reload');
		}
		
		workspace.plugins.emit('workspace.watch:' + file, ev, file);
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
	
	// Enable Test path
	if (this.configuration.debug)
		this.use(cxl.static(basePath + '/test', { maxAge: 86400000 }));
})

.createServer()

.use(compression())

.use(cxl.static(basePath + '/public', { maxAge: 86400000 }))

.use(bodyParser.json({ limit: Infinity }))

.route('GET', '/plugins', function(req, res) {
	res.send(this.plugins.getPackages());
})

.run(function() {
	require('./socket').start();
	require('./online').start();
	require('./project').start();
	require('./file').start();
	require('./assist').start();
	
	this.operation('Loading plugins', this.plugins.start.bind(this.plugins));
});

