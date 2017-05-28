
var
	EventEmitter = require('events').EventEmitter,
	fs = require('fs'),
	path = require('path'),

	Q = require('bluebird'),
	npm = require('npm'),
	_ = require('lodash'),

	common = require('./common.js'),
	workspace = global.workspace,

	NPM = {

	/** Calls npm and returns a promise with the result */
	doNpm(cmd, args, cwd)
	{
		args = args || [];

		return this.load(cwd).then(function(npm) {
			return new Q(function(resolve, reject) {

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
		return new Q(function(resolve, reject) {
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

		this.ready = Q.props({
			source: mod.source ? _.result(mod, 'source') :
				(mod.sourcePath ? common.read(mod.sourcePath) : ''),
			pkg: common.load_json(path + '/package.json')
		}).bind(this).then(function(data) {
			this.source = data.source;
			this.package = data.pkg;
			this.onlineWatch = workspace.online.watch('/plugins/'+this.id, this.onValue, this);

			return this;
		}, function(e) {
			this.mod.error(`Failed to load plugin ${this.name}`);
			this.mod.error(e);
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

		this.onlineWatch.unsubscribe();
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
		return {
			installed: true,
			id: this.id,
			name: this.package.name,
			description: this.package.description,
			version: this.package.version,
			npmVersion: this.npmVersion,
			unofficial: this.unofficial,
			local: this.local
		};
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

	enable(project, id)
	{
		console.log(project, id);
		return Promise.resolve(this.plugins[id].toJSON());
	}

	disable(project, id)
	{
		console.log(project, id);
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
				workspace.reload();
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
			workspace.reload();
			return a;
		}).then(function() {
			return me.getOnlinePackages().then(function(packages) {
				var pkg = packages[id];
				pkg.id = id;
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
		return workspace.online.get('plugins').catch(function(e) {
			workspace.dbg('Could not retrieve plugin list from server');
			workspace.error(e);
			return {};
		});
	}

	getPackages()
	{
		var plugins = this.plugins;

		return this.getOnlinePackages().then(function(all) {

			this.packages = Object.assign({}, all);

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

		return Q.all(_.map(me.plugins, 'ready'));
	}

	loadLocalPlugins()
	{
		var plugins = workspace.configuration.plugins;

		if (plugins)
			plugins.forEach(function(name) {
				this.requireFile(path.resolve(name), true);
			}, this);
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

	start()
	{
		this.loadLocalPlugins();

		workspace.plugins.on('assist.inline', this.onInlineAssist.bind(this));

		return this.loadWorkspacePlugins().bind(this).then(function() {

			for (var i in this.plugins)
				this.plugins[i].start();

			this.loadScripts(workspace.configuration.scripts);

			setImmediate(
				this.emit.bind(this, 'workspace.load', workspace));
		});
	}

}

workspace.route('POST', '/plugins/install', function(req, res) {
	common.respond(workspace, res, workspace.plugins.install(req.body.id));
})

.route('POST', '/plugins/uninstall', function(req, res) {
	common.respond(workspace, res, workspace.plugins.uninstall(req.body.id));
})

.route('POST', '/plugins/enable', function(req, res) {
var
	p = workspace.projectManager.getProject(req.body.project)
;
	common.respond(workspace, res, workspace.plugins.enable(p, req.body.id));
})

.route('POST', '/plugins/disable', function(req, res) {
var
	p = workspace.projectManager.getProject(req.body.project)
;
	common.respond(workspace, res, workspace.plugins.disable(p, req.body.name));
})

.route('GET', '/plugins', function(req, res) {
	common.respond(workspace, res, this.plugins.getPackages());
});

workspace.NPM = NPM;
workspace.PluginManager = PluginManager;
