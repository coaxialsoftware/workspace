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

	/**
	 * Opens a file.
	 * @param filename Name of the file relative to project.
	 * @param options {object|string} If string it will be treated as target
	 * @param options.target Open file in new window.
	 */
	open: function(filename, options)
	{
	var
		cb = function(f) { ide.plugins.edit(f, options); },
		target = options ? (typeof(options)==='string' ? options: options.target) : 0
	;
		if (target)
			window.open(
				'#' + ide.workspace.hash.encode({ f: filename || false }),
				target
			);
		else if (typeof(filename) === 'string')
			ide.project.open(filename, cb);
		else if (filename instanceof ide.File)
			cb(filename);
		else
			cb(new ide.File(filename));
	},

	set_editor: function(editor)
	{
		var info = editor.get_info();
		this.editor = editor;
		window.document.title = info || 'ide.js';

		if (info)
			ide.info.show(info);
	},

	/** @class */
	Plugin: function(p)
	{
		_.extend(this, p);
	},

	Info: Backbone.View.extend({ /** @lends ide.Info# */

		_delay: 1000,

		el: '#info',

		show: function(msg)
		{
		var
			me = this
		;
			me.$el.html(msg).show()
				.delay(me._delay).fadeOut()
			;

			return me;
		}
	}),

	Workspace: Backbone.View.extend({ /** @lends ide.Workspace# */

		el: '#workspace',

		layout: function(el)
		{
		var
			i=0,
			child = el.children,
			l = child.length,
			result, w
		;
			switch (l)
			{
			case 0: return;
			case 1: return [{ left: 0, top: 0, height: '100%', width: '100%' }];
			case 2: return [
					{ left: 0, top: 0, height: '100%', width: '50%' },
					{ left: '50%', top: 0, height: '100%', width: '50%' }
				];
			}

			w = Math.floor(100 / (Math.ceil(l/2)));
			result = [];

			if (l % 2)
			{
				i = w;
				result.push({ left: 0, top: 0, height: '100%', width: w + '%'});
			}

			for (; i<100; i+=w)
				result.push(
					{ left: i+'%', top: 0, width: w + '%', height: '50%' },
					{ left: i+'%', top: '50%', width: w + '%', height: '50%' }
				);

			return result;
		},

		_do_layout: function()
		{
		var
			me = this,
			child = me.children,
			layout,
			i = 0
		;
			if (!me.layout)
				return;

			layout = me.layout(me.el);

			for (; i<child.length; i++)
				child[i].$el.css(layout[i]);

			setTimeout(function() { me.trigger('layout'); });
		},

		load: function()
		{
			var files = this.hash.data.f || this.hash.data.file;

			ide.plugins.start();
			$('#mask').hide();

			if (!files)
				return;

			if (files instanceof Array)
				files.forEach(ide.open, ide);
			else
				ide.open(files);
		},

		/**
		 * Save workspace state in the URL Hash.
		 */
		save: function()
		{
			var hash = this.hash, files = [];

			this.children.forEach(function(child) {
				if (child.file)
					files.push(child.file.get('filename') || '');
			});

			if (files.length===1)
				files = files[0];
			else if (files.length===0)
				files = 0;

			if (hash.data.project)
			{
				hash.data.p = hash.data.project;
				delete hash.data.project;
			}

			delete hash.data.file;
			hash.set({ f: files });
		},

		close_all: function()
		{
			this.children.concat().forEach(this.remove.bind(this));
		},

		add: function(item)
		{
			this.children.push(item);
			this.$el.append(item.el);
			this._do_layout();
			this.trigger('add_child', item);
			item.focus();

			this.save();

			return this;
		},

		remove: function(item, force)
		{
			if (item.close(force)===false)
				return;

			this.children.splice(this.children.indexOf(item), 1);

			if (this.children[0])
				this.children[0].focus();
			else
				ide.editor = null;

			this._do_layout();
			this.save();

			this.trigger('remove_child', item);

			return this;
		},

		initialize: function Workspace()
		{
		var
			hash = this.hash = new Hash(),
			project = this.project = ide.project = new ide.Project({
				path: hash.data.p || hash.data.project
			})
		;
			this.children = [];

			project.fetch();
			project.on('sync', this.load, this);
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
		this._plugins = {};
		this._shortcuts = {};
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

		/** If key is pressed, invoke function will be called. */
		shortcut: null,
		/** Function to call when shortcut key is pressed. */
		invoke: null,
		/// Object of commands to add to ide.commands
		commands: null,

		/**
		 * Starts Plugin when all other plugins are loaded.
		 * @param settings Settings specified in the project. The name of the plugin will be used.
		 */
		start: function() { }
	});

	_.extend(ide.PluginManager.prototype, { /** @lends ide.PluginManager# */

		_plugins: null,

		/**
		 * List of system shortcuts. Added by plugins with the shortcut property
		 * defined.
		 */
		_shortcuts: null,

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
		 * @param options {object}
		 */
		edit: function(file, options)
		{
			var cb = function(plug) {
				if (plug.edit) return plug.edit(file, options);
			};

			if (options && options.plugin)
				cb(this._plugin[options.plugin]);

			this.each(cb);
		},

		get_shortcut: function(ev)
		{
			return (ev.shiftKey ? 'shift-' : '') +
				(ev.ctrlKey ? 'ctrl-' : '') +
				(ev.altKey ? 'alt-' : '') +
				ev.keyCode;
		},

		on_key: function(ev)
		{
		var
			key = this.get_shortcut(ev),
			fn = this._shortcuts[key]
		;
			if (fn)
			{
				fn();
				ev.preventDefault();
			}
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

		_registerShortcut: function(key, name, plugin)
		{
			if (key in this._shortcuts)
				window.console.warn('[' + plugin + '] Overriding shortcut ' + key);

			this._shortcuts[key] = plugin.invoke.bind(plugin);
		},

		register: function(name, plugin)
		{
			this._plugins[name] = plugin;

			for (var i in plugin.commands)
				this._registerCommand(name, i, plugin.commands[i]);

			if (plugin.shortcut)
				this._registerShortcut(plugin.shortcut, name, plugin);
		}

	});

	function Hash()
	{
	var
		hash = this.decode()
	;
		this.data = hash;
	}

	_.extend(Hash.prototype, {

		data: null,

		clean: function(hash)
		{
			for (var i in hash)
				if (!hash[i])
					delete hash[i];

			return hash;
		},

		decode: function()
		{
		var
			h = '{'+window.location.hash.substr(1)+'}',
			result
		;
			try {
				result = (h && this.clean(JSON.parse(h)));
			} catch (e) {
				window.location.hash = '';
			} finally {
				return result || {};
			}
		},

		encode: function(obj)
		{
		var
			data = $.extend({}, this.data, obj),
			hash = JSON.stringify(this.clean(data))
		;
			return hash.slice(1, hash.length-1);
		},

		set: function(obj)
		{
			$.extend(this.data,obj);
			window.location.hash = this.encode();
		}
	});

	/// Plugin Manager
	ide.plugins = new ide.PluginManager();
	/// Asset/Script Loader
	ide.loader = new window.Loader();

	window.addEventListener('load', _start);

	ide.Editor = Backbone.View.extend({ /** @lends ide.Editor# */

		file: null,

		/**
		 * Handles commands
		 * @type {Function}
		 */
		cmd: null,

		initialize: function(p)
		{
			_.extend(this, p);

			this.$el.on('click', this._on_click.bind(this));
			this.setup();
		},

		_on_click: function()
		{
			if (ide.editor!==this)
				this.focus();
		},

		hide: function()
		{
			this.$el.hide().css('opacity', 0);
		},

		show: function()
		{
			this.$el.show().css('opacity', 1);
		},

		get_info: function()
		{
			return this.file ?
				(this.file.get('filename') + ' [' + this.file.get('path') + ']')
			:
				'';
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
