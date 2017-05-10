
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


var PluginComponent = cxl.component({
	name: 'ide-plugin-item',
	shadow: false,
	template: `<ide-item class="item">
<ide-item-tags><cxl-fragment &="repeat(tags)"><ide-tag &="item:text"></ide-tag></cxl-fragment>
</ide-item-tags><code &="=code:|text"></code><ide-item-title &="=title:|text">
</ide-item-title><ide-item-description &="=description:|if:|text"></ide-item-description>
<ide-item-footer>
<span &="=local:unless">
<cxl-submit &="=installed:unless click:#install =loadInstall:set(submitting)">Install</cxl-submit>
<cxl-submit &="=installed:if click:#uninstall =loadInstall:set(submitting)">Uninstall</cxl-submit>
<span>
<!--span &="=installed:show">
<cxl-submit &="=enabled:unless click:#enable =loadEnable:set(submitting)">Enable</cxl-submit>
<cxl-submit &="=enabled:if click:#disable =loadEnable:set(submitting)">Disable</cxl-submit>
</span-->
</ide-item-footer></ide-item>`
}, class {

	constructor(a)
	{
		this.render(a);
	}

	render(a)
	{
	var
		enabled = ide.project.get('plugins'),
		tags = this.tags = []
	;
		if (a.enabled)
			tags.push('Enabled');
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

		if (enabled && enabled.indexOf(a.id)!==-1)
			a.enabled = true;

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

		cxl.ajax.post(url, {
			project: ide.project.id,
			id: this.code
		}).then(function(res) {
			me.render(res);
		}, function(er) {
			ide.error(er);
		}).then(function() {
			// TODO
			me.loadInstall = me.loadEnable = false;
			cxl.renderer.digest(me.$component);
		});
	}

	install()
	{
		this.loadInstall = true;
		this.post('/plugins/install');
	}

	uninstall()
	{
		this.loadInstall = true;
		this.post('/plugins/uninstall');
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

ide.plugins.register('plugins', {
	commands: {
		plugins: function() {
		var
			me = this, l = new ide.ListEditor({
				plugin: this,
				title: 'plugins',
				itemClass: ide.ComponentItem,
				file: 'list'
			})
		;
			cxl.ajax.get('/plugins').then(function(all) {
				me.addPlugins(l, all);
			});

			return l;
		},

		'plugins.install': {
			fn: function(id) {
				return cxl.ajax.post('/plugins/install', {
					project: ide.project.id,
					id: id
				});
			},
			description: 'Install Plugin',
			args: [ 'plugin' ],
			icon: 'cog'
		},

		'plugins.uninstall': {
			fn: function(id) {
				return cxl.ajax.post('/plugins/uninstall', {
					project: ide.project.id,
					id: id
				});
			},
			description: 'Uninstall Plugin',
			args: [ 'plugin' ],
			icon: 'cog'
		}
	},

	addPlugins: function(l, all)
	{
		var a, i, items=[];

		if (!all)
			ide.warn('Could not retrieve plugins from server.');

		for (i in all)
		{
			a = all[i];
			items.push(new PluginComponent(a));
		}

		l.add(cxl.sortBy(items, 'title'));
	}

});

})(this.ide, this.cxl);
