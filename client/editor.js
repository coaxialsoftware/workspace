/**
 * @license
 *
 */

(function(window, _, Backbone, $) {
"use strict";

var
	_nots,

	ide = window.ide = new (Backbone.View.extend({ /** @lends ide */

	project: null,
	workspace: null,
	plugins: null,
	info: null,
	hash: null,
	loader: null,

	alert: function(message)
	{
		ide.notify(message, 'warn');
	},

	error: function(message)
	{
		ide.notify(message, 'error');
	},

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
		var info = editor.get_info();
		this.editor = editor;
		window.document.title = info;

		if (info)
			ide.info.show(info);
	},

	Plugin: function(p)
	{
		_.extend(this, p);
	},

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

	Workspace: Backbone.View.extend({

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
			child = this.children,
			layout,
			i = 0
		;
			if (!this.layout)
				return;

			layout = this.layout(this.el);

			for (; i<child.length; i++)
				child[i].$el.css(layout[i]);
		},

		add: function(item)
		{
			this.children.push(item);
			this.$el.append(item.el);

			item.on('close', this.remove_child, this);

			this._do_layout();
			this.trigger('add_child', item);

			return this;
		},

		remove_child: function(item)
		{
			this.children.splice(this.children.indexOf(item), 1);
			if (this.children[0])
				this.children[0].focus();
			this._do_layout();

			this.trigger('remove_child', item);

			return this;
		},

		initialize: function Workspace()
		{
			this.children = [];
			this.on('add_child', this.on_add_child);
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
			this.on('error', this.on_error);
		},

		on_error: function()
		{
			ide.error('Could not load Project: ' + this.id);
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

	PluginManager: function()
	{
		this._plugins = {};
	}

}))(),
	_start= function()
	{
	var
		hash = ide.hash.data
	;
		ide.workspace = new ide.Workspace();
		ide.info = new ide.Info();

		_nots = $('<div id="ide-notification">').appendTo(window.document.body);

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
	_.extend(ide.Plugin.prototype, {
		shortcut: null,
		invoke: null,

		start: function() { }
	});

	_.extend(ide.PluginManager.prototype, {

		_plugins: null,

		/**
		 * Iterates through plugins and stops if fn returns true.
		 */
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
				if (plug.edit)
					return plug.edit(file);
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

		register: function(name, plugin)
		{
			this._plugins[name] = plugin;
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

	ide.plugins = new ide.PluginManager();
	ide.hash = new Hash();
	ide.loader = new window.Loader();

	window.addEventListener('load', _start);

	ide.Editor = Backbone.View.extend({

		file: null,

		initialize: function(p)
		{
			_.extend(this, p);

			this.$el.on('click', this.focus.bind(this));
			this.setup();
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
			//setTimeout(function() { el.focus(); });
			el.focus();
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
				fn = ide.editor.cmd && ide.editor.cmd(cmd[0]);
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
				ide.alert('Unknown Command: ' + val);
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

			if (ide.editor && ide.editor.find)
				ide.editor.find(regex);
		}

	});

	ide.plugins.register('search', new ide.Bar.Search());
	ide.plugins.register('command', new ide.Bar.Command());

})(this, this._, this.Backbone, this.jQuery);
