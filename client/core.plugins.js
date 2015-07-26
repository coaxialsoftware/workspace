
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

function KeyboardManager()
{
	var _MAP = this.MAP;

	for (var i = 1; i < 20; ++i)
		_MAP[111 + i] = 'f' + i;

	for (i = 0; i <= 9; ++i)
		_MAP[i + 96] = i+'';
	
	for (i=65; i<91; ++i)
		_MAP[i] = String.fromCharCode(i).toLowerCase();

	window.addEventListener('keydown', this.onKeyDown.bind(this));

	//window.addEventListener('keydown', this.onKeyDown.bind(this));
	//window.addEventListener('keydown', this.onKeyDown.bind(this));
}

cxl.extend(KeyboardManager.prototype, {

	delay: 250,
	t: 0,
	sequence: null,

	MAP: {
		8: 'backspace', 9: 'tab', 13: 'enter', 	17: 'ctrl',
		18: 'alt', 20: 'capslock', 27: 'esc', 32: 'space',
		33: 'pageup', 34: 'pagedown', 35: 'end', 36: 'home',
		37: 'left', 38: 'up', 39: 'right', 40: 'down',
		45: 'ins', 46: 'del', 91: 'meta', 93: 'meta',
		224: 'meta', 106: '*', 107: '+', 109: '-',
		110: '.', 111 : '/', 186: ';', 187: '=',
		188: ',', 189: '-', 190: '.', 191: '/',
		192: '`', 219: '[', 220: '\\', 221: ']', 222: '\''
	},

	MODMAP: {
		16: 'shift', 17: 'ctrl', 18: 'alt',
		93: 'meta', 224: 'meta'
	},

	SHIFTMAP: {
		192: '~', 222: '"', 221: '}', 220: '|',
		219: '{', 191: '?', 190: '>', 189: '_',
		188: '<', 187: '+', 186: ':', 48: ')',
		49: '!', 50: '@', 51: '#', 52: '$', 53: '%',
		54: '^', 55: '&', 56: '*', 57: '(' 
	},

	getChar: function(ev)
	{
	var
		key = ev.keyCode || ev.which,
		ch
	;
		if (this.MODMAP[key])
			return;
		if (ev.shiftKey && (ch = this.SHIFTMAP[key]))
			ev.noShift = true;
		else
			ch = this.MAP[key];

		if (ch===undefined)
			ch = String.fromCharCode(key);

		return ch;
	},

	getKeyId: function(ev)
	{
	var
		mods = [],
		ch = this.getChar(ev)
	;
		if (!ch)
			return;
		if (ev.ctrlKey)
			mods.push('ctrl');
		if (ev.altKey)
			mods.push('alt');
		if (ev.shiftKey && !ev.noShift)
			mods.push('shift');
		if (ev.metaKey)
			mods.push('meta');

		mods.push(ch);
		
		return mods.join('+');
	},

	onKeyDown: function(ev)
	{
	var
		t = Date.now(),
		k = this.getKeyId(ev)
	;
		if (!k)
			return;

		if (t - this.t < this.delay)
			this.sequence.push(k);
		else
			this.sequence = [ k ];
		this.t = t;
		
		window.console.log(ev, this.sequence.join(' '));
	},

	bind: function()
	{
	}

});
	
function PluginManager()
{
	this._plugins = {};
	this.keyboard = new KeyboardManager();
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

			if (plug.start)
				plug.start(ide.project[name]);

			for (var i in plug.commands)
			{
				var fn = plug.commands[i];

				this._registerCommand(name, i, typeof(fn)==='string' ?
					fn : fn.bind(plug));
			}
			
			this.registerShortcuts(plug);

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

	handleKey: function(action)
	{
		if (this && this.actions && this.actions[action])
			this.actions[action].call(this);
		else
			ide.action(action);

		return false;
	},
	
	_registerKey: function(key, fn, plugin)
	{
		var handler = (typeof(fn)==='function') ?
			fn.bind(plugin)
		:
			this.handleKey.bind(plugin, fn);
		
		this.keyboard.bind(key, handler);
	},

	registerShortcuts: function(plugin)
	{
	var
		keymap = ide.project.get('plugins.keymap') || 'default',
		map = plugin.shortcuts && plugin.shortcuts[keymap],
		key
	;
		for (key in map)
			this._registerKey(key, map[key], plugin);
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
