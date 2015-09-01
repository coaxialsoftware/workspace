
(function(ide, cxl, $, _) {
"use strict";
	
/** @class */
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
	},
	
	listenTo: function(name, fn)
	{
		this.__listeners.push({ name: name, fn: fn });
		ide.plugins.on(name, fn, this);
		
		return this;
	},
	
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
			if (fn.bind(this)(this._plugins[i], i))
				return true;
		}
	},
	
	findEditor: function(file, options, plugin)
	{
		var me = this;
		
		function cb(plug)
		{
			return plug.edit && plug.edit(file, options);
		}
		
		function find()
		{
			var result = me.each(cb);
			
			if (!result)
				ide.defaultEdit(file, options);
		}
		
		if (file.attributes.content || !file.attributes.filename)
			find();
		else
			file.fetch({
				success: plugin ?
					cb.bind(me, plugin) :
					find
			});
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

		this.findEditor(file, options, plugin);
	},

	/**
	 * Loads plugins from project config
	 */
	load_plugins: function()
	{
		// TODO Find a better place for this.
		ide.keymap.state = ide.project.get('keymap') || 'default';

		this.each(function(plug, name) {

			if (plug.start)
				plug.start(ide.project[name]);
			
			this.registerCommands(plug);
			
			if (plug.shortcuts)
				this.registerShortcuts(plug);
		});

		this.each(function(plug) {
			if (plug.ready)
				plug.ready();
		});
	},
	
	loadSource: function(src)
	{
		/* jshint evil:true */
		if (src)
			(new Function(src)).call(window);
	},

	start: function()
	{
		this.started = true;
		
		this.loadSource(ide.project.get('src'));
		this.load_plugins();
	},
	
	registerCommands: function(plugin)
	{
		for (var i in plugin.commands)
			ide.registerCommand(i, plugin.commands[i], plugin);
		
		for (i in plugin.editorCommands)
			ide.registerEditorCommand(i, plugin.editorCommands[i], plugin);
	},

	registerShortcuts: function(plugin)
	{
		ide.keymap.registerKeys(plugin.shortcuts, plugin);
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
	
ide.plugins.register('plugins', {
	commands: {
		plugins: function() { this.open(); }
	},
	
	addPlugins: function(l, all, installed)
	{
		var enabled = ide.project.get('plugins');
		
		if (!all)
		{
			ide.notify('Could not retrieve plugins from server.', 'warn');
			all = _.extend({}, installed);
		}
		
		_.each(all, function(p, k) {
			if (k in installed)
				all[k].installed = true;
			if (enabled && enabled.indexOf(k)!==-1)
				all[k].enabled = true;
		});

		l.addFiles(_.values(all));
	},
	
	open: function()
	{
	var
		me = this,
		l = new ide.FileList({
			title: 'plugins',
			file_template: '#tpl-plugins',
			plugin: this
		})
	;
		$.when(
			$.get(ide.project.get('online.url') + '/plugins.json'),
			$.get('/plugins')
		).then(function(all, installed) {
			me.addPlugins(l, all[0], installed[0]);
		});
		
		ide.workspace.add(l);
	}
});

})(this.ide, this.cxl, this.jQuery, this._);
