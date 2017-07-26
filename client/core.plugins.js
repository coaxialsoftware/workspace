
(function(ide, cxl) {
"use strict";

/**
 *
 * Main Plugin class for all plugins.
 *
 */
ide.Plugin = function Plugin(p)
{
	cxl.extend(this, p);
	this.__resources = [];
};

cxl.extend(ide.Plugin.prototype, { /** @lends ide.Plugin# */

	/** @type {string} Plugin Name */
	name: null,

	/** If key is pressed, invoke function will be called. */
	shortcuts: null,
	/** Editor Commands */
	editorCommands: null,
	/// Object of commands to add to ide.commands
	commands: null,

	/// Runs when all plugins are initialized @type {function}
	ready: null,

	__resources: null,

	/**
	 * Starts Plugin when all other plugins are loaded.
	 * @param settings Settings specified in the project. The name of the plugin will be used.
	 */
	start: function() { },

	/**
	 * Saves or retrieves local storage data
	 */
	data: function(prop, value)
	{
		prop = 'ide.plugin.' + this.name + '.' + prop;

		if (arguments.length===1)
			return window.localStorage[prop];

		if (value!==undefined)
			window.localStorage[prop] = value;
		else
			delete(window.localStorage[prop]);
	},

	/**
	 * Register resources to be destroy when reloading.
	 */
	resources: function()
	{
		for (var i=0; i<arguments.length;i++)
			this.__resources.push(arguments[i]);
	},

	/**
	 * Adds event handler.
	 */
	listenTo: function(name, fn)
	{
		this.resources(ide.plugins.on(name, fn, this));
		return this;
	},

	listenToElement: function(el, name, fn)
	{
		this.resources(cxl.listenTo(el, name, fn));
	},

	/**
	 * Unbinds all event handlers and destroys plugin
	 */
	destroy: function()
	{
		// TODO...
		cxl.invokeMap(this.__resources, 'unsubscribe');
		cxl.invokeMap(this.__resources, 'destroy');
		ide.plugins.unregister(this);
	}

});

function PluginManager()
{
	this._plugins = {};
	this.on('project.load', this.reload, this);
}

cxl.extend(PluginManager.prototype, cxl.Events, {

	started: false,

	source: null,

	_plugins: null,

	reload: function()
	{
		if (!this.started || this.source===ide.project.get('plugins.src'))
			return;

		cxl.each(this._plugins, function(p) {
			if (!p.core)
				p.destroy();
		});

		this.start();
		this.ready();
	},

	get: function(name)
	{
		return this._plugins[name];
	},

	/**
	 * Iterates through plugins and stops if fn returns true.
	 */
	each: function(fn)
	{
		for (var i in this._plugins)
		{
			var result = fn.bind(this)(this._plugins[i], i);

			if (result)
				return result;
		}
	},

	/**
	 * Finds best editor for current file. options.file must be a ide.File.
	 */
	findPlugin: function(options)
	{
		return this.each(function(plug) {
			return plug.open && plug.open(options);
		}) || ide.defaultEdit(options);
	},

	loadPlugin: function(plug, name)
	{
		if (this.started && plug.core)
			return;

		try {
			if (plug.start)
				plug.start(ide.project[name]);

			this.registerCommands(plug);

			if (plug.shortcuts)
				this.registerShortcuts(plug);
		} catch(e)
		{
			window.console.error(e);
			ide.error('Error loading plugin "' + name + '"');
		}
	},

	ready: function()
	{
		this.each(function(plug) {
			if (this.started && plug.core)
				return;
			if (plug.ready)
				plug.ready();
		});

		this.started = true;
	},

	start: function()
	{
		var src = this.source = ide.project.get('plugins.src');

		if (src)
			ide.source(src);

		this.each(this.loadPlugin);
	},

	/**
	 * Register commands and editor commands
	 */
	registerCommands: function(plugin)
	{
		for (var i in plugin.commands)
			plugin.resources(ide.registerCommand(i, plugin.commands[i], plugin));

		for (i in plugin.editorCommands)
			plugin.resources(ide.registerEditorCommand(i, plugin.editorCommands[i], plugin));
	},

	/**
	 * Registers new keymap shortcuts
	 */
	registerShortcuts: function(plugin)
	{
		ide.keymap.registerKeys(plugin.shortcuts, plugin);
	},

	/**
	 * Registers a new plugin
	 */
	register: function(name, plugin)
	{
		if (!(plugin instanceof ide.Plugin))
			plugin = new ide.Plugin(plugin);

		this._plugins[name] = plugin;
		plugin.name = name;
	},

	unregister: function(plug)
	{
		// TODO
		delete this._plugins[plug.name];
	}

});


var PluginComponent = cxl.component({
	name: 'ide-plugin-item',
	shadow: false,
	bindings: [ 'ide.on(project.load):#render'],
	template: `<ide-item class="item">
<ide-item-tags><cxl-fragment &="repeat(tags)"><ide-tag &="item:text"></ide-tag></cxl-fragment>
</ide-item-tags><code &="=code:|text"></code><ide-item-title &="=title:|text">
</ide-item-title><ide-item-description &="=description:|if:|text"></ide-item-description>
<ide-item-footer &="=local:unless">
<span>
<cxl-submit &="=installed:unless click:#install =loadInstall:set(submitting)">Install</cxl-submit>
<cxl-submit &="=installed:if click:#uninstall =loadInstall:set(submitting)">Uninstall</cxl-submit>
<span>
</ide-item-footer></ide-item>`
}, class {

	constructor(a)
	{
		this.data = a;
		this.render();
	}

	render()
	{
	var
		tags = this.tags = [],
		a = this.data
	;
		if (a.installed)
			tags.push('Installed');
		if (a.unofficial)
			tags.push('Unofficial');
		if (a.local)
			tags.push('Local');

		if (a.npmVersion)
		{
			if (a.version<a.npmVersion)
				tags.push('Update Available');
			else if (a.version>a.npmVersion)
				tags.push('NPM: ' + a.npmVersion);
		}

		tags.push(a.version);

		this.code = a.id;
		this.title = a.name;
		this.description = a.description;
		this.installed = a.installed;
		this.enabled = a.enabled;
		this.version = a.version;
	}

	post(url)
	{
		var me = this;

		return cxl.ajax.post(url, {
			project: ide.project.id,
			id: this.code
		}).then(function(res) {
			me.data = res;
			me.render();
		}, function(er) {
			ide.error(er);
		}).then(function() {
			// TODO
			me.loadInstall = me.loadEnable = false;
		});
	}

	install()
	{
		this.loadInstall = true;
		return this.post('/plugins/install');
	}

	uninstall()
	{
		this.loadInstall = true;
		return this.post('/plugins/uninstall');
	}

	enable()
	{
		this.loadEnable = true;
		this.post('/plugins/enable');
	}

	disable()
	{
		this.loadEnable = true;
		this.post('/plugins/disable');
	}

});

/**
 * Plugin Manager
 * @type {ide.PluginManager}
 */
ide.plugins = new PluginManager();
ide.PluginComponent = PluginComponent;

cxl.directive('ide.on', {
	initialize: function()
	{
		this.listenTo(ide.plugins, this.parameters, this.set);
	}
});

})(this.ide, this.cxl);
