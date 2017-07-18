
var
	EventEmitter = require('events').EventEmitter,
	fs = require('fs'),
	path = require('path'),
	UglifyJS = require('uglify-es'),

	npm = require('npm'),
	_ = require('lodash'),

	common = require('./common.js'),
	workspace = global.workspace,
	ServerResponse = require('./http').ServerResponse,
	file = require('./file'),

	NPM = {

	/** Calls npm and returns a promise with the result */
	doNpm(cmd, args, cwd)
	{
		args = args || [];

		return this.load(cwd).then(function(npm) {
			return new Promise(function(resolve, reject) {

				try {
					cwd = cwd ? path.resolve(cwd) :
						workspace.configuration['plugins.path'] || process.cwd();

					args.push(function(er, data) {
						if (er)
							return reject({
								error: er,
								data: data
							});

						resolve(data);
					});

					npm.prefix = cwd;
					npm.commands[cmd].apply(npm.commands, args);
				}
				catch(e) { reject(e); }
			});
		});
	},

	load: function()
	{
		return new Promise(function(resolve, reject) {
			npm.load(function(er, npm) {
				if (er)
					return reject(er);

				try {
					npm.config.set('json', true);
					npm.config.set('depth', 0);

					resolve(npm);
				}
				catch(e) { reject(e); }
			});
		});
	},

	install: function(module)
	{
		return this.doNpm('install', [ [ module ] ]).then(function(a) {
			return a[0][1];
		});
	},

	uninstall: function(module)
	{
		return this.doNpm('uninstall', [ [ module ] ]);
	}

};

class Plugin {

	constructor(path, local)
	{
		this.path = path;
		this.local = local;
		this.resolvedPath = require.resolve(path);
		this.load();
	}

	load()
	{
	var
		path = this.path,
		mod = this.mod = require(path)
	;
		// TODO ...umm
		this.id = mod.name.replace(/^workspace\./, '')
			.replace(/\./g, '-');
		this.name = mod.name;

		this.ready = Promise.all([
			// source
			mod.source ? _.result(mod, 'source') :
				(mod.sourcePath ? common.read(mod.sourcePath) : ''),
			// package
			common.load_json(path + '/package.json')
		]).then(data => {
			this.source = data[0];
			this.package = data[1];

			return this;
		}, function(e) {
			this.mod.error(`Failed to load plugin ${this.name}`);
			this.mod.error(e);
			return Promise.reject(e);
		});

		if (mod.sourcePath)
		{
			this.onWatchFn = this.onWatch.bind(this);
			this.sourceWatch = workspace.watch(mod.sourcePath, this.onWatchFn);
		}
	}

	start()
	{
		this.mod.start();
	}

	unload()
	{
		if (this.mod.destroy)
			this.mod.destroy();
		// Invalidate require cache
		delete require.cache[this.resolvedPath];

		if (this.sourceWatch)
			workspace.unwatch(this.sourceWatch, this.onWatchFn);
	}

	reload()
	{
		this.unload();
		this.load();
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
		{
			this.unofficial = true;
			return this.mod.dbg('Plugin not in main repository.');
		}

		this.npmVersion = data.version;

		if (data.version !== this.package.version)
			this.mod.dbg(`New version ${data.version} available!`);
	}

	toJSON()
	{
		var json = {
			installed: true,
			id: this.id,
			npmVersion: this.npmVersion,
			unofficial: this.unofficial,
			local: this.local
		};

		if (this.package)
		{
			json.name = this.package.name;
			json.description = this.package.description;
			json.version = this.package.version;
		}

		return json;
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
		this.on('plugins.source', this.resetSources.bind(this));
	}

	resetSources()
	{
		this.cachedSources = null;
	}

	enable(project, id)
	{
		return Promise.resolve(this.plugins[id].toJSON());
	}

	disable(project, id)
	{
		return Promise.resolve(this.plugins[id].toJSON());
	}

	/**
	 * Install plugins locally using npm
	 */
	install(id)
	{
		var me = this, name = '@cxl/workspace.' + id;

		return workspace.operation(`Installing plugin ${name}`, NPM.install(name)
			.then(function(path) {
				var plugin = me.requireFile(path);
				return plugin.ready;
			}).then(function(plugin) {
				workspace.restart();
				return plugin.toJSON();
			}));
	}

	uninstall(id)
	{
	var
		me = this,
		name = '@cxl/workspace.' + id,
		plugin = this.plugins[id]
	;
		workspace.dbg(`Uninstalling plugin ${name}`);

		return NPM.uninstall(name).then(function(a) {
			if (plugin)
			{
				plugin.unload();
				delete me.plugins[id];
			}
			workspace.dbg(`Successfully uninstalled plugin ${name}`);
			return a;
		}).then(function() {
			return me.getOnlinePackages().then(function(packages) {
				var pkg = packages[id];
				pkg.id = id;
				workspace.restart();
				return pkg;
			});
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

	requireFile(file, local)
	{
		try {
			fs.statSync(file);
			var plugin = new Plugin(file, local);
			this.register(plugin);
			return plugin;
		} catch(e) {
			workspace.error(`Could not load plugin: ${file}`);
			workspace.dbg(e);
		}
	}

	getOnlinePackages()
	{
		var url = workspace.configuration['plugins.url'];

		return cxl.request(url).then(function(res) {
			return JSON.parse(res.body);
		}, function(e) {
			workspace.dbg('Could not retrieve plugin list from server');
			workspace.error(e);
			return {};
		});
	}

	getPackages()
	{
		var plugins = this.plugins;

		return this.getOnlinePackages().then(all => {

			this.packages = all;

			_.each(plugins, function(a, k) {
				if (a)
					all[k] = a;
				else
					workspace.error(`package.json not found for plugin "${k}"`);
			});

			// TODO ?
			_.each(all, function(a, k) {
				a.id = k;
			});

			return all;
		});
	}

	loadWorkspacePlugins()
	{
	var
		me = this,
		regex = /^workspace\./,
		dir = workspace.configuration['plugins.path'] ||
			path.join(process.cwd(), 'node_modules', '@cxl'),
		data
	;
		if (fs.existsSync(dir))
		{
			workspace.dbg(`Loading global plugins from ${dir}`);
			data = fs.readdirSync(dir);

			_.each(data, function(d) {
				if (regex.test(d))
					me.requireFile(path.resolve(dir, d));
			});
		}

		return Promise.all(_.map(me.plugins, 'ready'));
	}

	loadLocalPlugins()
	{
		var plugins = workspace.configuration.plugins;

		if (plugins)
			plugins.forEach(function(name) {
				this.requireFile(path.resolve(name), true);
			}, this);
	}

	compileSources()
	{
		return workspace.operation('Compiling Plugin Sources', () => {
			var result = UglifyJS.minify(this.cachedSources, {
				compress: false,
				mangle: true
			});

			if (result.error)
				return workspace.error(result.error);

			if (result.warnings)
				result.warnings.forEach(w => workspace.warn(w));

			this.cachedSources = result.code;
		});
	}

	getSources()
	{
		if (this.cachedSources)
			return this.cachedSources;

		var result='', i;

		for (i in this.plugins)
		{
			if (this.plugins[i].source)
				result += this.plugins[i].source;
		}

		if (this.scripts)
			result += this.scripts;

		if (!workspace.configuration.debug)
			setImmediate(this.compileSources.bind(this));

		return (this.cachedSources = result);
	}

	loadScripts(scripts)
	{
		if (!scripts)
			return;

		if (typeof(scripts)==='string')
			scripts = [ scripts ];

		this.scripts = '';

		this.scriptWatchers = scripts.map(function(s) {

			var fn, id;

			try {
				workspace.dbg(`Loading script "${s}"`);
				this.scripts += fs.readFileSync(s, 'utf8');

				fn = this.onScriptsWatch.bind(this);
				id = workspace.watch(s, fn);

				return { unbind: workspace.unwatch.bind(workspace, id, fn) };
			} catch(e) {
				workspace.error(`Could not load script "${s}".`);
				workspace.dbg(e);
			}
		}, this);

	}

	onScriptsWatch()
	{
		_.invokeMap(this.scriptWatchers, 'unbind');
		this.loadScripts(workspace.configuration.scripts);
		workspace.plugins.emit('plugins.source', this.id, this.source);
	}

	onInlineAssist(done, data)
	{
		var token = data.token, hints;

		if (token.type!=='plugin')
			return;

		hints = workspace.assist.findObject(this.plugins, token.cursorValue);

		if (hints.length)
			done(hints);
	}

	loadTests()
	{
		var files = [], plugin, fn;

		function onError(e)
		{
			workspace.dbg(e.message);
		}

		for (var i in this.plugins)
		{
			plugin = this.plugins[i];
			fn = plugin.path + '/tests.js';
			files.push(file.read(fn).catch(onError));
		}

		return Promise.all(files).then(function(content) {
			return content.join("\n");
		}, onError);
	}

	start()
	{
		this.loadLocalPlugins();

		workspace.plugins.on('assist.inline', this.onInlineAssist.bind(this));

		return this.loadWorkspacePlugins().then(() => {

			for (var i in this.plugins)
			{
				try {
					this.plugins[i].start();
				} catch(e)
				{
					workspace.error(`Error loading plugin "${i}"`);
					workspace.error(e);
				}
			}

			this.loadScripts(workspace.configuration.scripts);

			setImmediate(
				this.emit.bind(this, 'workspace.load', workspace));
		});
	}

}

workspace.route('POST', '/plugins/install', function(req, res) {

	ServerResponse.respond(res, workspace.plugins.install(req.body.id), this);

}).route('POST', '/plugins/uninstall', function(req, res) {

	ServerResponse.respond(res, workspace.plugins.uninstall(req.body.id), this);

})

.route('GET', '/plugins/tests', function(req, res, next) {
	if (!workspace.configuration.debug)
		next();

	res.set('content-type', 'text/javascript');
	ServerResponse.respond(res, workspace.plugins.loadTests(), this);
})

.route('POST', '/plugins/enable', function(req, res) {
var
	p = workspace.projectManager.getProject(req.body.project)
;
	ServerResponse.respond(res, workspace.plugins.enable(p, req.body.name), this);
})

.route('POST', '/plugins/disable', function(req, res) {
var
	p = workspace.projectManager.getProject(req.body.project)
;
	ServerResponse.respond(res, workspace.plugins.disable(p, req.body.name), this);
})

.route('GET', '/plugins', function(req, res) {
	ServerResponse.respond(res, workspace.plugins.getPackages(), this);
});

workspace.NPM = NPM;
workspace.PluginManager = PluginManager;
