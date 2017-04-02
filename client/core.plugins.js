
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
	this.__listeners = [];
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
	 * Adds event handler.
	 */
	listenTo: function(name, fn)
	{
		this.__listeners.push({ name: name, fn: fn });
		ide.plugins.on(name, fn, this);

		return this;
	},

	/**
	 * Unbinds all event handlers and destroys plugin
	 */
	destroy: function()
	{
		this.__listeners.forEach(function(l) {
			ide.plugins.off(l.name, l.fn, this);
		}, this);
	}

});

function PluginManager()
{
	this._plugins = {};
}

cxl.extend(PluginManager.prototype, cxl.Events, {

	started: false,

	_plugins: null,

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

	/**
	 * Loads plugins from project config
	 */
	load_plugins: function()
	{
		this.each(function(plug, name) {

			if (plug.start)
				plug.start(ide.project[name]);

			this.registerCommands(plug);

			if (plug.shortcuts)
				this.registerShortcuts(plug);
		});
	},
	
	ready: function()
	{
		this.each(function(plug) {
			if (plug.ready)
				plug.ready();
		});
	},

	start: function()
	{
		var src = ide.project.get('plugins.src');

		if (src)
			ide.source(src);

		this.started = true;
		this.load_plugins();
	},

	/**
	 * Register commands and editor commands
	 */
	registerCommands: function(plugin)
	{
		for (var i in plugin.commands)
			ide.registerCommand(i, plugin.commands[i], plugin);

		for (i in plugin.editorCommands)
			ide.registerEditorCommand(i, plugin.editorCommands[i], plugin);
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
		this._plugins[name] = plugin;
		plugin.name = name;
	}

});

class PluginItem extends ide.Item {

	post(url)
	{
		cxl.ajax.post(url, this).then(this.render.bind(this));
	}

	install()
	{
		this.post('/plugins/install');
	}

	uninstall()
	{
		this.post('/plugins/uninstall');
	}

	enable()
	{
		this.post('/plugins/enable');
	}

	disable()
	{
		this.post('/plugins/disable');
	}

}

/**
 * Plugin Manager
 * @type {ide.PluginManager}
 */
ide.plugins = new PluginManager();
	
ide.plugins.register('plugins', {
	commands: {
		plugins: function() {
		var
			me = this, l = new ide.ListEditor({
				plugin: this,
				title: 'plugins',
				itemTemplate: null,
				itemClass: PluginItem,
				file: 'list'
			})
		;
			cxl.ajax.get('/plugins').then(function(all) {
				me.addPlugins(l, all);
			});

			return l;
		}
	},

	addPlugins: function(l, all)
	{
		var enabled = ide.project.get('plugins'), a, i, items=[], tags;

		if (!all)
			ide.warn('Could not retrieve plugins from server.');
		
		for (i in all)
		{
			a = all[i];
			tags = [ a.version ];
			
			if (enabled && enabled.indexOf(i)!==-1)
				tags.push('Enabled');
			if (a.installed)
				tags.push('Installed');
			
			items.push(new ide.Item({
				code: i,
				title: a.name,
				description: a.description,
				tags: tags
			}));
		}
		
		l.add(items);
	}

});

})(this.ide, this.cxl);
