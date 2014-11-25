/**
 * @license
 *
 */

(function(window, _, Backbone, $) {
"use strict";

var
	_nots,

	ide =
	/** @namespace */
	window.ide = new (Backbone.View.extend({ /** @lends ide */

	/** Current opened project */
	project: null,

	/** Current workspace */
	workspace: null,

	/** Plugin Manager */
	plugins: null,

	/** Information window on left corner */
	info: null,

	/** Asset, script loader */
	loader: null,

	/** Displays alert notification on right corner */
	alert: function(message)
	{
		ide.notify(message, 'warn');
	},

	/** Displays error notification on right corner */
	error: function(message)
	{
		ide.notify(message, 'error');
	},

	warn: function(message)
	{
		ide.notify(message, 'warn');
	},

	/** Displays notification on right corner */
	notify: function(message, kls)
	{
		kls = kls || 'info';
	var
		span = $('<div class="ide-notification ide-' + kls +
			'">' + message + '</div>')
	;
		span.prependTo(_nots).delay(3000)
			.slideUp(function() { span.remove(); });
		window.console[kls](message);
	},

	/** Displays log message in console only */
	log: function(message)
	{
		window.console.log('[ide.js] ' + message);
	},

	/**
	 * Opens file in new tab
	 */
	open_tab: function(filename, target)
	{
		window.open(
			'#' + ide.workspace.hash.encode({ f: filename || false }),
			target
		);
	},

	/**
	 * Opens a file.
	 * @param filename {ide.File|string} Name of the file relative to project or a File object.
	 * @param options {object|string} If string it will be treated as target
	 * @param options.target Open file in new window.
	 */
	open: function(filename, options)
	{
		ide.plugins.edit(filename || '', options || {});
	},

	set_editor: function(editor)
	{
		var info = editor.get_info();

		if (this.editor)
			this.editor.$el.removeClass('ide-focus');

		this.editor = editor;
		window.document.title = info || 'ide.js';

		editor.$el.addClass('ide-focus');

		if (info)
			ide.info.show(info);
	},

	/** @class */
	Plugin: function(p)
	{
		_.extend(this, p);
	},

	Info: Backbone.View.extend({ /** @lends ide.Info# */

		_delay: 1500,

		_timeout: null,

		el: '#info',

		hide: function()
		{
			if (this._timeout)
				window.clearTimeout(this._timeout);

			this._timeout = window.setTimeout(
				this.$el.fadeOut.bind(this.$el), this._delay);

			return this;
		},

		show: function(msg)
		{
			var s = this.el.style, s2 = ide.editor.el.style;
			s.left = s2.left;
			s.width = s2.width;
			s.top = s2.top;

			this.$el.html(msg).stop().show();
			return this.hide();
		}
	}),

	File: Backbone.Model.extend({ /** @lends ide.File# */

		idAttribute: 'filename',

		initialize: function()
		{
			this.on('error', this._onError);
		},

		_onSync: function()
		{
			this.trigger('write');
			ide.notify('File ' + this.id + ' saved.');
		},

		_onError: function()
		{
			ide.error('Error saving file: ' + this.id);
		},

		save: function()
		{
			Backbone.Model.prototype.save.call(this, null, {
				success: this._onSync.bind(this)
			});
		},

		isNew: function()
		{
			return this.attributes.new;
		},

		parse: function(response)
		{
			response.ext = /(?:\.([^.]+))?$/.exec(response.filename)[1];
			return response;
		},

		url: function()
		{
		var
			stat = this.get('stat'),
			mtime = stat ? (new Date(stat.mtime)).getTime() : false
		;
			return '/file?p=' + this.get('path') +
				'&n=' + this.id + '&t=' + mtime;
		},

		toString: function()
		{
			return this.get('filename') || '';
		}

	}),

	Project: Backbone.Model.extend({ /** @lends ide.Project# */

		idAttribute: 'path',

		url: function()
		{
			return '/project' + (this.id ? '?n=' + this.id : '');
		},

		constructor: function()
		{
			Backbone.Model.prototype.constructor.apply(this, arguments);
			this.on('sync', this.on_project);
			this.on('error', this.on_error);
		},

		on_error: function()
		{
			ide.error('Error loading Project: ' + this.id);
		},

		/**
		 * Open a file
		 */
		open: function(filename, callback)
		{
		var
			file = new ide.File({
				path: this.get('path'),
				filename: filename || ''
			})
		;
			return file.fetch({ success: callback });
		},

		on_project: function()
		{
			this.files_text = this.get('files').join("\n");
			this.trigger('load');
		}

	}),

	PluginManager: function()
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

}))(),
	_start= function()
	{
		ide.workspace = new ide.Workspace();
		ide.info = new ide.Info();

		_nots = $('<div id="ide-notification">').appendTo(window.document.body);
	}

;
	_.extend(ide.Plugin.prototype, { /** @lends ide.Plugin# */

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

		/** Saves or retrieves local storage data */
		data: function(prop, value)
		{
			prop = 'ide.plugin.' + this.name + '.' + prop;

			if (arguments.length===1)
				return window.localStorage[prop];

			window.localStorage[prop] = value;
		}
	});

	_.extend(ide.PluginManager.prototype, { /** @lends ide.PluginManager# */

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
		edit: function(file, options)
		{
		var
			plugin = options.plugin && this.get(options.plugin),
			cb = function(plug)
			{
				return plug.edit && plug.edit(file, options);
			}
		;
			if (plugin && plugin.open)
				return plugin.open(file, options);

			if (typeof(file)==='string')
				file = { filename: file };

			file.filename = file.filename || '';
			file.path = ide.project.get('path');

			options.slot = ide.workspace.slot();

			file = new ide.File(file);

			if (file.attributes.content)
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

			for (var i in plugin.commands)
				this._registerCommand(name, i, plugin.commands[i].bind(plugin));

			if (plugin.shortcut)
				this._registerShortcut(
					plugin.shortcut, name, plugin, plugin.invoke);
		}

	});

	/**
	 * Plugin Manager
	 * @type {ide.PluginManager}
	 */
	ide.plugins = new ide.PluginManager();

	/**
	 * Asset/Script Loader
	 * @type Loader
	 */
	ide.loader = new window.Loader();

	window.addEventListener('load', _start);

	ide.Editor = Backbone.View.extend({

		constructor: function(p)
		{
			_.extend(this, p);

			if (!this.slot)
				this.slot = ide.workspace.slot();

			this.el = this.slot.el;
			this.$el = this.slot.$el
				.on('click', this._on_click.bind(this));
			this.slot.editor = this;

			Backbone.View.prototype.constructor.call(this, p);
			this.setup();
		},

		/** Plugin that instantiated the editor @required */
		plugin: null,

		/**
		 * File that is being edited or command to restore state.
		 * @required
		 */
		file: null,

		/**
		 * Handles commands
		 * @type {Function}
		 */
		cmd: null,

		_on_click: function()
		{
			if (ide.editor!==this)
				this.focus();
		},

		get_info: function()
		{
			return this.file.toString() + ' [' + ide.project.get('name') + ']';
		},

		/** Gets the current editor state. Used to persist workspace state in the url hash. */
		state: function()
		{
			return this.plugin.name + ':' + this.file.toString();
		},

		focus: function()
		{
			ide.set_editor(this);
			this.trigger('focus');
		},

		close: function()
		{
			// Remove first so do_layout of workspace works.
			this.remove();
			this.trigger('close', this);
		}

	});

})(this, this._, this.Backbone, this.jQuery);
