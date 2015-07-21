
(function(ide, cxl, CodeMirror) {
"use strict";
	
/** @class */
ide.Plugin = function Plugin(p)
{
	cxl.extend(this, p);
};
	
cxl.extend(ide.Plugin.prototype, { /** @lends ide.Plugin# */

	/** @type {string} Plugin Name */
	name: null,

	/** If key is pressed, invoke function will be called. */
	shortcuts: null,
	/** Editor Actions */
	actions: null,
	/// Object of commands to add to ide.commands
	commands: null,

	/// Runs when all plugins are initialized @type {function}
	ready: null,

	/**
	 * Starts Plugin when all other plugins are loaded.
	 * @param settings Settings specified in the project. The name of the plugin will be used.
	 */
	start: function() { },

	log: function(msg, klass)
	{
		ide.notify('[' + this.name + '] ' + msg, klass);
	},

	/**
	 * Saves or retrieves local storage data
	 */
	data: function(prop, value)
	{
		prop = 'ide.plugin.' + this.name + '.' + prop;

		if (arguments.length===1)
			return window.localStorage[prop];

		window.localStorage[prop] = value;
	},

	/**
	 * Sends data through web socket
	 */
	send: function(data)
	{
		ide.socket.send(this.name, data);
		return this;
	}
});
	
function PluginManager()
{
	this._plugins = {};
	
	// Bind Events using CodeMirror handlers
	var cm = {
		options: { keyMap: 'vim' },
		state: { keyMaps: [] },
		curOp: {},
		execCommand: function(cmd)
		{
			CodeMirror.commands[cmd].call(cm);
		},
		operation: function(cb) {
			cb();
		}
	};
	
	window.addEventListener('keypress', CodeMirror.onKeyPress.bind(cm));
	window.addEventListener('keydown', CodeMirror.onKeyUp.bind(cm));
	window.addEventListener('keyup', CodeMirror.onKeyDown.bind(cm));
}

cxl.extend(PluginManager.prototype, cxl.Events, {

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
			if (fn.bind(this)(this._plugins[i], i))
				break;
		}
	},

	/**
	 * Opens a file if supported by a plugin.
	 *
	 * @param file {string} File name or Plugin state
	 * @param options {object} Required.
	 */
	edit: function(path, options)
	{
	var
		plugin = options.plugin && this.get(options.plugin),
		cb = function(plug)
		{
			return plug.edit && plug.edit(file, options);
		},
		file
	;
		if (plugin && plugin.open)
			return plugin.open(path, options);

		if (!path || typeof(path)==='string')
			file = ide.fileManager.getFile(path);
		else
		{
			file = ide.fileManager.getFile();
			file.set(path);
		}

		options.slot = ide.workspace.slot();

		if (file.attributes.content || !file.attributes.filename)
			this.each(cb);
		else
			file.fetch({
				success: plugin ?
					cb.bind(this, plugin) :
					this.each.bind(this, cb)
			});
	},

	/**
	 * Loads plugins from project config
	 */
	load_plugins: function()
	{
		this.each(function(plug, name) {

			for (var i in plug.commands)
			{
				var fn = plug.commands[i];

				this._registerCommand(name, i, typeof(fn)==='string' ?
					fn : fn.bind(plug));
			}
			
			this.registerActions(plug);
			this.registerShortcuts(plug);

			if (plug.start)
				plug.start(ide.project[name]);
		});
		this.each(function(plug) {
			if (plug.ready)
				plug.ready();
		});

	},

	start: function()
	{
	var
		plugins = ide.project.plugins,
		i
	;
		for (i in plugins)
			ide.loader.script(plugins[i]);

		ide.loader.ready(this.load_plugins.bind(this));
	},
	
	// TODO add debug check
	registerActions: function(plugin)
	{
		for (var i in plugin.actions)
			CodeMirror.commands[i] = plugin.actions[i].bind(plugin);
	},

	_registerCommand: function(plugin, name, fn)
	{
		if (ide.commands[name])
			window.console.warn('[' + plugin +
			'] Overriding command ' + name);

		ide.commands[name] = fn;
	},
	
	_registerKey: function(map, key, fn, plugin)
	{
		if (typeof(fn)==='function')
			fn = fn.bind(plugin);
		
		if (key in map)
			window.console.warn('[' + name + '] Overriding shortcut ' + key);
			
		map[key] = fn;
	},

	registerShortcuts: function(plugin)
	{
		var keymap, map, key;
		
		for (keymap in plugin.shortcuts)
		{
			map = CodeMirror.keyMap[keymap];
			
			if (!map)
				ide.alert('keyMap not found: ' + keymap);
			else 	
				for (key in plugin.shortcuts[keymap])
					this._registerKey(map, key, plugin.shortcuts[keymap][key], plugin);
		}
	},

	register: function(name, plugin)
	{
		this._plugins[name] = plugin;
		plugin.name = name;
	}

});

/**
 * Plugin Manager
 * @type {ide.PluginManager}
 */
ide.plugins = new PluginManager();
	
})(this.ide, this.cxl, this.CodeMirror);