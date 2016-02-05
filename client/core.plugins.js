
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
			var result = fn.bind(this)(this._plugins[i], i);

			if (result)
				return result;
		}
	},

	findPlugin: function(options, deferred)
	{
	var
		plugin = options.plugin,
		editor = plugin ?
			(plugin.open || plugin.edit).call(plugin, options) :
			this.each(function(plug) {
				var r = plug.edit && plug.edit(options);
				return r && (r.plugin = plug) && r;
			}) || ide.defaultEdit(options)
	;
		if (editor)
			ide.workspace.add(editor);

		deferred.resolve(editor);
	},

	/**
	 * Opens a file if supported by a plugin.
	 *
	 * @param options {object} Required.
	 * @param options.file {ide.File} File Object. Required.
	 * @param options.plugin {ide.Plugin} Plugin
	 */
	edit: function(options, result)
	{
	var
		me = this,
		file = options.file
	;
		options.slot = options.slot || ide.workspace.slot();

		if (!file.attributes || file.attributes.content || !file.attributes.filename)
			this.findPlugin(options, result);
		else
			file.fetch({
				silent: true,
				success: function() {
					delete file.changed;
					me.findPlugin(options, result);
				}
			});

		return result;
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

ide.Plugin.Item = cxl.View.extend({

	render: function(msg)
	{
		if (msg)
			ide.notify(msg);

		this.loadTemplate();
	},

	post: function(url)
	{
		ide.post(url, this).then(this.render.bind(this));
	},

	install: function()
	{
		this.post('/plugins/install');
	},

	uninstall: function()
	{
		this.post('/plugins/uninstall');
	},

	enable: function()
	{
		this.post('/plugins/enable');
	},

	disable: function()
	{
		this.post('/plugins/disable');
	}

});

/**
 * Plugin Manager
 * @type {ide.PluginManager}
 */
ide.plugins = new PluginManager();

ide.plugins.register('plugins', {
	commands: {
		plugins: function() {
			return ide.workspace.add(this.open({ plugin: this }));
		}
	},

	addPlugins: function(l, all, installed)
	{
		var enabled = ide.project.get('plugins');

		if (!all)
		{
			ide.warn('Could not retrieve plugins from server.');
		}

		all = _.merge(all || {}, installed);
		_.each(all, function(a, k) {
			a.installed = k in installed;
			a.enabled = (enabled && enabled.indexOf(k)!==-1);
		});

		l.add(_.values(all));
	},

	open: function(options)
	{
	var
		me = this, l
	;
		_.extend(options, {
			title: 'plugins',
			itemTemplate: cxl.html('tpl-plugin'),
			itemClass: ide.Plugin.Item,
			file: 'list'
		});

		l = new ide.Editor.List(options);

		$.when(
			$.get(ide.project.get('online.url') + '/plugins.json'),
			$.get('/plugins')
		).then(function(all, installed) {
			me.addPlugins(l, all[0], installed[0]);
		});

		return l;
	}
});

})(this.ide, this.cxl, this.jQuery, this._);
