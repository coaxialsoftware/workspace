/**
 *
 * workspace Module
 *
 */
"use strict";

var
	EventEmitter = require('events').EventEmitter,
	fs = require('fs'),
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
		if (typeof(key)==='object')
			cxl.extend(this, key);
		else
			this[key] = value;

		return this.update();
	}

	/**
	 * Will extend configuration, it will not override array or objects.
	 */
	extend(obj)
	{
		common.extend(this, obj);
		return this.update();
	}

	/**
	 * Loads a JSON configuration file. Uses extend method to set properties.
	 */
	loadFile(fn)
	{
		var obj = common.load_json_sync(fn);

		if (obj)
			this.extend(obj);
		else
			workspace.dbg(`Could not read JSON file ${fn}`);

		return obj;
	}
}

class WorkspaceConfiguration extends Configuration {

	constructor()
	{
		super();

		this.loadFile('~/.workspace.json');
		this.loadFile('workspace.json');

		if (this['plugins.global']===undefined && !this['plugins.path'])
			this['plugins.global'] = true;

		this.set({
			version: '0.3.0',
			user: process.env.USER || process.env.USERNAME
		});

		if (this.debug)
			cxl.enableDebug();
	}

	onUpdate()
	{
		workspace.plugins.emit('workspace.reload');
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
	scripts: null,

	/**
	 * Default help URL. Defaults to /docs/index.html
	 */
	'help.url': null,

	'online.url': 'https://cxl.firebaseio.com/workspace'

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
		workspace.dbg(`Plugin ${this.name} source updated.`);
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

	/** Calls npm and returns a promise with the result */
	doNpm(cmd, a, b, fn)
	{
	var
		pluginsPath = workspace.configuration['plugins.path'],
		global = workspace.configuration['plugins.global'],
		cwd = process.cwd(),
		args = [ a ]
	;
		if (arguments.length===4)
			args.push(b);
		else if (arguments.length===3)
			fn = b;

		return new Q(function(resolve, reject) {
			npm.load(function(er, npm) {
				if (pluginsPath)
					process.chdir(pluginsPath);

				npm.config.set('global', global);
				npm.config.set('json', true);
				npm.config.set('depth', 0);

				try {
					if (typeof(cmd)!=='function')
					{
						args.push(function(er, data) {
							if (er)
								return reject(er);

							resolve(fn(data));
						});

						npm.commands[cmd].apply(npm.commands, args);
					} else
						resolve(cmd(npm));
				}
				catch(e) { reject(e); }
				finally
				{
					if (pluginsPath)
						process.chdir(cwd);
				}
			});
		});

	}

	/**
	 * Install plugins locally using npm
	 */
	install(name, version)
	{
		// Make sure we only include plugins from cxl workspace.
		if (name.indexOf('@cxl/workspace')!==0)
			return Q.reject(`Invalid plugin name "${name}"`);

		workspace.dbg(`Installing plugin ${name} ${version}`);
		return this.doNpm('install', '.', [ name ], function() {
			return `Successfully installed plugin ${name}`;
		});
	}

	uninstall(name, version)
	{
		// Make sure we only include plugins from cxl workspace.
		if (name.indexOf('@cxl/workspace')!==0)
			return Q.reject("Invalid plugin name");

		workspace.dbg(`Uninstalling plugin ${name} ${version}`);
		return this.doNpm('uninstall', [ name ], function() {
			return `Successfully uninstalled plugin ${name}`;
		});
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
			workspace.dbg(e);
		}
	}

	requirePlugins(plugins)
	{
		if (plugins)
			plugins.forEach(this.requirePlugin, this);
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
		var plugins = this.plugins;

		return workspace.online.get('plugins').catch(function(e) {
			workspace.dbg('Could not retrieve plugin list from server');
			workspace.error(e);
			return {};
		}).then(function(all) {
			var installed = _.mapValues(plugins, 'package');

			_.each(installed, function(a, k) {
				all[k] = a;
				a.installed = true;
			});

			return all;
		});
	}

	loadGlobalPlugins()
	{
	var
		me = this,
		regex = /^workspace\./,
		data, dir
	;
		return this.doNpm(function(npm) {
			dir = path.join(npm.dir, '@cxl');
			workspace.dbg(`Loading global plugins from ${dir}`);

			data = fs.readdirSync(dir);

			_.each(data, function(d) {
				if (regex.test(d))
				{
					me.requireFile(path.join(dir, d));
				}
			});

			return _.map(me.plugins, 'ready');
		});
	}

	loadLocalPlugins()
	{
		this.requirePlugins(workspace.configuration.plugins);
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
				workspace.error('Could not load script "${s}".');
				workspace.dbg(e);
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

		return this.loadGlobalPlugins().all().bind(this).then(function() {

			for (var i in this.plugins)
				this.plugins[i].start();

			this.loadScripts(workspace.configuration.scripts);

			setImmediate(
				this.emit.bind(this, 'workspace.load', workspace));
		});
	}

}

class Theme
{
	constructor(p)
	{
		this.path = path.isAbsolute(p) ? p :
			basePath + '/public/theme/' + p + '.css';

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

	add(path, theme)
	{
		return (this.themes[path] = theme);
	}

	load(path)
	{
		var theme = this.themes[path] || this.add(path, new Theme(path));
		return theme.source ? Q.resolve(theme) : theme.load();
	}

}

workspace.extend({

	Configuration: Configuration,

	configuration: new WorkspaceConfiguration(),

	plugins: new PluginManager(),
	themes: new ThemeManager(),
	basePath: basePath,
	cwd: path.resolve(process.cwd()),
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

	__watches: {},

	watch: function(path, cb)
	{
	var
		id = this.watcher.watchFile(path),
		watches = this.__watches[id] || (this.__watches[id]=[])
	;
		this.dbg(`Watching File ${id}`);

		if (cb)
		{
			watches.push(cb);
			this.plugins.on('workspace.watch:' + id, cb);
		}

		return id;
	},

	unwatch: function(id, cb)
	{
		this.watcher.unwatch(id);
		_.pull(this.__watches, cb);
		this.plugins.off('workspace.watch:' + id, cb);
	},

	onWatch: function(ev, file)
	{
		if (file==='workspace.json')
		{
			this.configuration = new WorkspaceConfiguration();
		}
		console.log(file);

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

	this.secure = this.configuration.secure;
})

.createServer()

.use(compression())

.use(cxl.static(basePath + '/public', { maxAge: 86400000 }))

.use(cxl.bodyParser.json({ limit: Infinity }))

.route('GET', '/plugins', function(req, res) {
	common.respond(workspace, res, this.plugins.getPackages());
})

.route('POST', '/plugins/install', function(req, res) {
	common.respond(workspace, res, workspace.plugins.install(req.body.name, req.body.version));
})

.route('POST', '/plugins/uninstall', function(req, res) {
	common.respond(workspace, res, workspace.plugins.uninstall(req.body.name, req.body.version));
})

.run(function() {
	require('./socket').start();
	require('./online').start();
	require('./project').start();
	require('./file').start();
	require('./assist').start();

	process.on('uncaughtException', this.error.bind(this));

	this.operation('Loading plugins', this.plugins.start.bind(this.plugins));
}).start();

