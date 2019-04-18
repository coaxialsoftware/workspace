
const
	fs = require('fs'),
	path = require('path').posix,
	UglifyJS = require('uglify-es'),

	FileWatch = require('@cxl/filewatch').FileWatch,
	EventEmitter = require('@cxl/rx').EventEmitter,
	plugin = module.exports = cxl('workspace.plugins'),
	NPM = ide.NPM
;

class PluginPackage {

	constructor()
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

class Plugin {

	constructor(pluginPath, local)
	{
		this.path = pluginPath;
		this.local = local;
		this.resolvedPath = require.resolve(path.join(ide.cwd, this.path));
		this.load();
	}

	load()
	{
	var
		path = this.path,
		mod = this.mod = require(this.resolvedPath)
	;
		// TODO ...umm
		this.id = mod.name.replace(/^workspace\./, '')
			.replace(/\./g, '-');
		this.name = mod.name;

		this.ready = Promise.all([
			// source
			mod.source ? mod.source :
				(mod.sourcePath ? cxl.file.read(mod.sourcePath) : ''),
			// package
			cxl.file.readJSON(path + '/package.json')
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
			this.sourceWatch = FileWatch.create(mod.sourcePath).subscribe(this.onWatch.bind(this));

		if (mod.settings)
			this.registerSettings(mod.settings);
	}

	registerSettings(settings)
	{
		for (var i in settings)
			ide.configuration.registerSetting(new ide.Setting(i, settings[i]));
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
			this.sourceWatch.unsubscribe();
	}

	update()
	{
		return NPM.update(this.name);
	}

	reload()
	{
		this.unload();
		this.load();
	}

	onWatch()
	{
		this.mod.dbg(`Plugin ${this.name} source updated.`);
		cxl.file.read(this.mod.sourcePath).then(d => {
			this.source = d;
			ide.plugins.emit('plugins.source', this.id, this.source);
		}, () => this.source = '');
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
		this.on('error', this.handleError.bind(this));
	}

	handleError(err)
	{
		plugin.error(err);
	}

	resetSources()
	{
		this.cachedSources = null;
		this.getSources();
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
		const name = '@cxl/workspace.' + id;

		return plugin.operation(`Installing plugin ${name}`, NPM.install(name)
			.then(path => require(path + '/package.json'))
			.then(plugin => {
				ide.restart();
				return plugin;
			}));
	}

	uninstall(id)
	{
	var
		me = this,
		name = '@cxl/workspace.' + id,
		p = this.plugins[id]
	;
		plugin.dbg(`Uninstalling plugin ${name}`);

		return NPM.uninstall(name).then(function(a) {
			if (p)
				delete me.plugins[id];

			plugin.dbg(`Successfully uninstalled plugin ${name}`);
			return a;
		}).then(function() {
			return me.getOnlinePackages().then(function(packages) {
				var pkg = packages[id];
				pkg.id = id;
				ide.restart();
				return pkg;
			});
		});
	}

	/**
	 * Registers a plugin
	 *
	 * @param {cxl.Module} cxl Module
	 */
	register(p)
	{
		if (p.id in this.plugins)
			throw `Plugin ${p.name} already registered.`;

		this.plugins[p.id] = p;

		return this;
	}

	requireFile(file, local)
	{
		try {
			fs.statSync(file);
			var p = new Plugin(file, local);
			this.register(p);
			return p;
		} catch(e) {
			plugin.error(`Could not load plugin: ${file}`);
			plugin.dbg(e);
		}
	}

	getOnlinePackages()
	{
		return ide.exec('npm search --json -l =cxl "@cxl/workspace."')
			.then(data => JSON.parse(data), () => {
				plugin.dbg('Could not retrieve plugin list from server');
				return {};
			}).then(all => {
				const result = {};

				all.forEach(pkg => {
					if (pkg.name.indexOf('@cxl/workspace.')===0)
					{
						result[pkg.name.slice(15)] = pkg;
						pkg.npmVersion = pkg.version;
					}
				});

				return result;
			})
		;
	}

	getPackages()
	{
		var plugins = this.plugins;

		return this.getOnlinePackages().then(all => {

			this.packages = all;

			cxl.each(plugins, function(a, k) {
				if (a)
				{
					if (k in all)
						Object.assign(all[k], {
							version: a.package.version,
							local: a.local,
							installed: true
						});
					else
						all[k] = Object.assign({}, a.toJSON(), {
							unofficial: true,
							local: a.local
						});
				}
				else
					plugin.error(`package.json not found for plugin "${k}"`);
			});

			return all;
		});
	}

	loadWorkspacePlugins()
	{
	var
		regex = /^workspace\./,
		dir = ide.configuration['plugins.path'] ||
			path.join('node_modules', '@cxl'),
		data
	;
		if (fs.existsSync(dir))
		{
			plugin.dbg(`Loading global plugins from ${dir}`);
			data = fs.readdirSync(dir);

			data.forEach(d => {
				if (regex.test(d))
					this.requireFile(path.join(dir, d));
			});
		}

		return Promise.all(cxl.map(this.plugins, p => p.ready));
	}

	loadLocalPlugins()
	{
		var plugins = ide.configuration.plugins;

		if (plugins)
			cxl.each(plugins, function(name) {
				this.requireFile(name, true);
			}, this);
	}

	sourcesUpdated()
	{
		ide.socket.broadcast('plugins', { refresh: true });
	}

	compileSources()
	{
		return plugin.operation('Compiling Plugin Sources', () => {
			var result = UglifyJS.minify(this.cachedSources, {
				compress: false,
				mangle: true
			});

			if (result.error)
				return plugin.error(result.error);

			if (result.warnings)
				result.warnings.forEach(w => plugin.warn(w));

			this.cachedSources = result.code;
			this.sourcesUpdated();
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

		if (!ide.configuration.debug)
			setImmediate(this.compileSources.bind(this));
		else
			this.sourcesUpdated();

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
			try {
				plugin.dbg(`Loading script "${s}"`);
				this.scripts += fs.readFileSync(s, 'utf8');

				const fn = this.onScriptsWatch.bind(this);
				return FileWatch.create(s).subscribe(fn);
			} catch(e) {
				plugin.error(`Could not load script "${s}".`);
				plugin.dbg(e);
			}
		}, this);

	}

	onScriptsWatch()
	{
		this.scriptWatchers.forEach(s => s.unsubscribe());
		this.loadScripts(ide.configuration.scripts);
		ide.plugins.emit('plugins.source', this.id, this.source);
	}

	onInlineAssist(done, data)
	{
		var token = data.features.token, hints;

		if (token.type!=='plugin')
			return;

		hints = ide.assist.findObject(this.plugins, token.cursorValue);

		if (hints.length)
			done(hints);
	}

	loadTests()
	{
		var files = [], p, fn;

		function onError(e)
		{
			plugin.dbg(e.message);
		}

		for (var i in this.plugins)
		{
			p = this.plugins[i];
			fn = p.path + '/tests.js';
			files.push(cxl.file.read(fn).catch(onError));
		}

		return Promise.all(files).then(function(content) {
			return content.join("\n");
		}, onError);
	}

	start()
	{
		this.loadLocalPlugins();

		ide.plugins.on('assist.inline', this.onInlineAssist.bind(this));

		return this.loadWorkspacePlugins().then(() => {

			for (var i in this.plugins)
			{
				try {
					this.plugins[i].start();
				} catch(e)
				{
					plugin.error(`Error loading plugin "${i}"`);
					plugin.error(e);
				}
			}

			this.loadScripts(ide.configuration.scripts);

			setImmediate(this.emit.bind(this, 'workspace.load', ide));
		});
	}

}

ide.plugins = new PluginManager();

plugin.config(function() {

	this.server = cxl('workspace').server;

}).route('POST', '/plugins/install', function(req, res) {

	ide.ServerResponse.respond(res, ide.plugins.install(req.body.id), this);

}).route('POST', '/plugins/uninstall', function(req, res) {

	ide.ServerResponse.respond(res, ide.plugins.uninstall(req.body.id), this);

})

.route('GET', '/plugins/tests', function(req, res, next) {
	if (!ide.configuration.debug)
		next();

	res.set('content-type', 'text/javascript');
	ide.ServerResponse.respond(res, ide.plugins.loadTests(), this);
})

.route('POST', '/plugins/enable', function(req, res) {
var
	p = ide.projectManager.getProject(req.body.project)
;
	ide.ServerResponse.respond(res, ide.plugins.enable(p, req.body.name), this);
})

.route('POST', '/plugins/disable', function(req, res) {
var
	p = ide.projectManager.getProject(req.body.project)
;
	ide.ServerResponse.respond(res, ide.plugins.disable(p, req.body.name), this);
})

.route('GET', '/plugins', function(req, res) {
	ide.ServerResponse.respond(res, ide.plugins.getPackages(), this);
});
