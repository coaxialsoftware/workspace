/**
 * @license
 *
 */

(function(window, _, Backbone, $, j5ui) {
"use strict";

var ide = window.ide = new (Backbone.View.extend({

	project: null,
	workspace: null,
	plugins: null,
	info: null,
	hash: null,
	loader: null,

	alert: j5ui.alert,

	open: function(filename)
	{
	var
		cb = function(f) { ide.plugins.edit(f); }
	;
		ide.project.open(filename, cb);
		ide.hash.set({ file: filename });
	},

	set_editor: function(editor)
	{
		this.editor = editor;
		window.document.title = editor.get_info();
	},

	Plugin: Backbone.View.extend({

		shortcut: null,
		invoke: null,

		edit: function()
		{
			return false;
		},

		start: function() { }

	}),

	Info: Backbone.View.extend({

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

	Workspace: j5ui.Container.extend({

		element: '#workspace',
		layout: j5ui.Layout.Smart,

		init: function Workspace()
		{
			j5ui.Container.apply(this, arguments);
			this.on('remove_child', this.on_remove_child);
			this.on('add_child', this.on_add_child);
		},

		on_add_child: function(c)
		{
			c.on('mousemove', this.on_editor_mouseover);
			c.on('focus', this.on_editor_focus, this);
		},

		on_editor_mouseover: function()
		{
			ide.info.show(this.get_info());
		},

		on_remove_child: function()
		{
			if (this.children[0]) this.children[0].focus();
		},

		on_editor_focus: function(editor)
		{
			ide.set_editor(editor);
		}

	}),

	File: Backbone.Model.extend({

		idAttribute: 'filename',

		initialize: function()
		{
			this.on('error', this._onError);
		},

		_onSync: function()
		{
			j5ui.info('File ' + this.id + ' saved.');
		},

		_onError: function()
		{
			j5ui.error('Error saving file: ' + this.id);
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

	Project: Backbone.Model.extend({

		idAttribute: 'path',

		url: function()
		{
			return '/project' + (this.id ? '?n=' + this.id : '');
		},

		constructor: function()
		{
			Backbone.Model.prototype.constructor.apply(this, arguments);
			this.on('sync', this.on_project);
		},

		/**
		 * Open a file
		 */
		open: function(filename, callback)
		{
		var
			file = new ide.File({
				path: this.get('path'),
				filename: filename
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

	PluginManager: j5ui.Class.extend({

		_plugins: null,

		init: function PluginManager()
		{
			this._plugins = {};
		},

		each: function(fn)
		{
			for (var i in this._plugins)
			{
				if (fn.bind(this)(this._plugins[i]))
					break;
			}
		},

		edit: function(file)
		{
			this.each(function(plug) {
				if (plug.edit) plug.edit(file);
			});
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
			key = this.get_shortcut(ev)
		;
			this.each(function(plug)
			{
				if (plug.shortcut===key && plug.invoke)
					plug.invoke();
			});
		},

		/**
		 * Loads plugins from project config
		 */
		load_plugins: function()
		{
			window.addEventListener('keyup', this.on_key.bind(this));
			this.each(function(plug) {
				if (plug.start)
					plug.start();
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

		register: function(name, Klass)
		{
			this._plugins[name] = new Klass();
		}

	})
}))(),
	_start= function()
	{
	var
		hash = ide.hash.data
	;
		ide.workspace = new ide.Workspace();
		ide.info = new ide.Info();

		ide.project = new ide.Project({ path: hash.project });
		ide.project.fetch();
		ide.project.on('sync', _on_project);
	},

	_on_project= function()
	{
		ide.plugins.start();
		$('#mask').hide();

		if (ide.hash.data.file)
			ide.open(ide.hash.data.file);
	}
;

	function Hash()
	{
	var
		hash = this.decode()
	;
		this.data = hash;
	}

	_.extend(Hash.prototype, {

		data: null,

		decode: function()
		{
		var
			h = window.location.hash.substr(1)
		;
			return (h && JSON.parse(h)) || {};
		},

		encode: function(obj)
		{
		var
			hash = $.extend({}, this.data, obj)
		;

			return JSON.stringify(hash);
		},

		set: function(obj)
		{
			$.extend(this.data,obj);
			window.location.hash = this.encode();
		}
	});

	ide.plugins = new ide.PluginManager();
	ide.hash = new Hash();
	ide.loader = new window.Loader();

	window.addEventListener('load', _start);

	ide.Editor = j5ui.Widget.extend({

		init: function Editor()
		{
			j5ui.Widget.apply(this, arguments);
		},

		on_focus: function()
		{
			ide.set_editor(this);
		}

	});

	ide.Bar = Backbone.View.extend({

		/**
		 * When a key is pressed and its found here the
		 * function will be called. Use keys function to
		 * assign more bindings.
		 *
		 * @private
		 */
		_keys: null,

		/**
		 * Previous Value
		 */
		_value: '',

		invoke: function()
		{
			this.show();
		},

		initialize: function Bar()
		{
			this._keys = {
			// TODO Use Key constants
			27: function() { this.hide(); },
			13: function() { this.run(); this.hide(); },
			8: function() {
				if (this._value==='')
					this.hide();
				},
			9: function() {
			var
				el = this.el,
				i = el.value.lastIndexOf(' ', el.selectionStart)+1,
				text = ''
			;
				text = el.value.substr(i, el.selectionStart-i);

				if (this.on_complete)
					this.on_complete(text, i, el.selectionStart);
			},
			219: function(ev) {
				if (ev.ctrlKey)
					this.hide();
			}
			};

			this.$el.on('keyup', this.on_key.bind(this));
			this.$el.on('keydown', this.on_keydown.bind(this));
			this.$el.on('blur', this.on_blur.bind(this));
		},

		on_blur: function()
		{
			this.hide();
		},

		on_keydown: function(ev)
		{
			if (ev.keyCode===9)
				ev.preventDefault();
		},

		on_key: function(ev)
		{
		var
			fn = this._keys[ev.keyCode]
		;
			if (this.hidden)
				return;

			if (fn)
				fn.apply(this, [ ev ]);

			if (this.el.value!==this._value)
			{
				this._lastSearch = null;
				if (this.on_change)
					this.on_change(this.el.value);
			}

			this._value = this.el.value;
			ev.stopPropagation();
			return false;
		},

		keys: function(k)
		{
			$.extend(this._keys, k);
		},

		show: function()
		{
			this.$el.val('').show();
			this.hidden = false;
			this.focus();
		},

		focus: function()
		{
		var
			el = this.el
		;
			setTimeout(function() { el.focus(); });
		},

		hide: function()
		{
			this.$el.hide();

			this.hidden = true;
			if (ide.editor)
				ide.editor.focus();
			return false;
		},

		start: function()
		{
			document.body.appendChild(this.el);
		}

	});

	ide.Bar.Command = ide.Bar.extend({

		el: $('<input id="command" />'),
		shortcut: "shift-186",

		scan: function(text)
		{
			return text.split(' ');
		},

		parse: function(text)
		{
		var
			cmd = this.scan(text),
			fn = ide.commands[cmd[0]],
			scope = ide
		;
			if (fn)
			{
				if (typeof(fn)==='string')
					fn = ide.commands[fn];
			} else if (ide.editor)
			{
				fn = ide.editor.cmd(cmd[0]);
				scope = ide.editor;
			}

			cmd.shift();

			return {
				fn: fn,
				args: cmd,
				scope: scope
			};
		},

		run: function()
		{
		var
			val = this.el.value,
			cmd
		;
			if (val==='')
				return;

			cmd = this.parse(val);

			if (!cmd.fn)
				j5ui.alert('Unknown Command: ' + val);
			else
				cmd.fn.apply(cmd.scope, cmd.args);
		},

		on_complete: function(s, start, end)
		{
		var
			val = this.el.value,
			match
		;
			if (!this._lastSearch)
			{
				this._lastSearch = ide.project.files_text.match(new RegExp('^' + s + '[^/\n]*$', 'mg'));
				this._lastSearchStart = start;
				this._lastSearchIndex = 0;
			} else if (this._lastSearchIndex===this._lastSearch.length)
				this._lastSearchIndex = 0;

			if (!this._lastSearch)
				return;

			match = this._lastSearch[this._lastSearchIndex++];
			this._value = this.el.value = val.slice(0, start) + match + val.slice(end);
		}

	});

	ide.Bar.Evaluate = ide.Bar.extend({

		shortcut: 'shift-49',
		el: $('<input id="evaluate" />'),

		encode: function(response)
		{
			return response.toString().replace(/&/g, '&amp;').replace(/</g, '&lt;');
		},

		run: function()
		{
		/*jshint evil: true */
		var
			response = eval(this.el.value)
		;
			if (response === undefined)
				return;

			j5ui.info(response);
		}

	});

	ide.Bar.Search = ide.Bar.extend({

		el: $('<input id="search" />'),
		shortcut: '191',

		run: function()
		{
		},

		on_change: function(val)
		{
		var
			regex
		;
			try { regex = new RegExp(val, 'm'); } catch(e) { regex = val; }

			if (ide.editor)
				ide.editor.find(regex);
		}

	});

	ide.plugins.register('evaluate', ide.Bar.Evaluate);
	ide.plugins.register('search', ide.Bar.Search);
	ide.plugins.register('command', ide.Bar.Command);

	ide.plugins.register('error', ide.Plugin.extend({

		_error: function(error) //, url, line)
		{
			window.console.error(error);
		},

		start: function()
		{
			window.addEventListener('error', this._error.bind(this));
		}

	}));

})(this, this._, this.Backbone, this.jQuery, this.j5ui);
