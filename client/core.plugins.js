
(function(ide, cxl) {
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
	shortcut: null,
	/** Function to call when shortcut key is pressed. */
	invoke: null,
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
	var i=48;

	this._plugins = {};
	this._shortcuts = {};

	for (; i<91; i++)
	{
		this.keycodes[i] = String.fromCharCode(i).toLowerCase();
		this.keycodes[i+this._SHIFT] = String.fromCharCode(i);
	}
}

cxl.extend(PluginManager.prototype, cxl.Events, {

	/** @private Shift modifier */
	_SHIFT: 1000,

	_plugins: null,

	/**
	 * List of system shortcuts. Added by plugins with the shortcut property
	 * defined.
	 */
	_shortcuts: null,

	key_delay: 400,

	__key: '',

	keycodes: {
		1192: "~", 192: '`', 1049: "!", 1050: "@", 1051: "#",
		1052: "$", 1053: "%", 1054: "^", 1055: "&", 1056: "*",
		1057: "(", 1048: ")", 189: "-", 1189: '_', 1107: "+",
		107: '=', 1219: "{", 219: '[', 221: ']', 1221: "}",
		1220: "|", 220: "\\", 186: ";", 1186: ":", 1222: "\"",
		222: "'", 188: ",", 1188: '<', 1190: ">", 190: '.',
		191: '/', 1191: "?", 32: "space", 112: 'F1', 113: 'F2', 114: 'F3',
		115: 'F4', 116: 'F5', 117: 'F6', 118: 'F7', 119: 'F8',
		120: 'F9', 121: 'F10', 122: 'F11', 123: 'F12'
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

	get_shortcut: function(ev)
	{
	var
		shift = ev.shiftKey,
		code = ev.keyCode + (shift ? this._SHIFT : 0),
		k = this.keycodes[code]
	;
		if (k)
			shift = false;
		else
			 k = this.keycodes[ev.keyCode];

		if (k)
		{
			return (shift ? 'shift-' : '') +
				(ev.ctrlKey ? 'ctrl-' : '') +
				(ev.altKey ? 'alt-' : '') + k;
		}
	},

	on_key: function(ev)
	{
	var
		time = ev.timeStamp, key, fn,
		sc = this.get_shortcut(ev)
	;
		if (!sc)
			return;

		key = (time - this.__keyTime > this.key_delay) ?
			sc : this.__key + sc;

		this.__keyTime = time;
		fn = this._shortcuts[key] || this._shortcuts[sc];

		if (fn)
		{
			fn();
			this.__key = '';
			ev.preventDefault();
		} else
			this.__key = key;
	},

	/**
	 * Loads plugins from project config
	 */
	load_plugins: function()
	{
		window.addEventListener('keydown', this.on_key.bind(this));

		this.each(function(plug, name) {

			for (var i in plug.commands)
			{
				var fn = plug.commands[i];

				this._registerCommand(name, i, typeof(fn)==='string' ?
					fn : fn.bind(plug));
			}

			if (plug.shortcut)
				this._registerShortcut(
					plug.shortcut, name, plug, plug.invoke);

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

	_registerCommand: function(plugin, name, fn)
	{
		if (ide.commands[name])
			window.console.warn('[' + plugin +
			'] Overriding command ' + name);

		ide.commands[name] = fn;
	},

	_registerShortcut: function(key, name, plugin, fn)
	{
		if (typeof(key)==='object')
		{
			for (var i in key)
				this._registerShortcut(i, name, plugin, key[i]);
			return;
		}

		if (key in this._shortcuts)
			window.console.warn('[' + name + '] Overriding shortcut ' + key);

		this._shortcuts[key] = fn.bind(plugin);
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

	
})(this.ide, this.cxl);