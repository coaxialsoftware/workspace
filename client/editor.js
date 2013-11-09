/**
 * @license
 *
 */

(function(window, j5ui, Backbone) {
"use strict";

var ide = window.ide = new j5ui.Observable({

	project: null,
	workspace: null,
	plugins: null,
	info: null,
	hash: null,
	loader: null,

	open: function(filename)
	{
	var
		cb = function(f) { ide.plugins.edit(f); }
	;
		ide.project.open(filename, cb);
	},

	set_editor: function(editor)
	{
		this.editor = editor;
		window.document.title = editor.get_info();
	},

	Hash: j5ui.Class.extend({

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
			hash = j5ui.extend({}, this.data)
		;
			j5ui.extend(hash, obj);

			return JSON.stringify(hash);
		},

		init: function Hash()
		{
		var
			hash = this.decode()
		;
			this.data = hash;
		}

	}),

	Plugin: j5ui.Class.extend({

		shortcut: null,
		invoke: null,

		edit: function()
		{
			return false;
		},

		start: function() { }

	}),

	Info: Backbone.View.extend({

		_infoTimeout: null,

		el: '#info',

		show: function(msg)
		{
		var
			me = this
		;
			me.$el.html(msg).show();

			if (me._infoTimeout)
				clearTimeout(me._infoTimeout);

			me._infoTimeout = setTimeout(function() {
				me.$el.hide();
			}, 1000);

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

	File: j5ui.Observable.extend({

		/**
		 * File contents
		 */
		content: null,
		filename: null,
		mime: null,
		stat: null,

		init: function File(p)
		{
			j5ui.Observable.apply(this, [p]);
			this.ext = this.filename.split('.').pop();
		},

		save: function()
		{
		var
			mtime = this.new ? false : (new Date(this.stat.mtime)).getTime()
		;
			j5ui.post(
				'/file?n=' + encodeURIComponent(this.filename) +
				(mtime ? '&t=' + encodeURIComponent(mtime) : ''),
				{ content: this.content },
				this.on_write.bind(this)
			);
		},

		on_write: function(result)
		{
			if (result.success)
			{
				delete result.success;
				j5ui.extend(this, result);

				this.fire('write');
				j5ui.info('File ' + this.filename + ' saved.');
			} else
				j5ui.error(result.error);
		}

	}),

	Project: j5ui.Observable.extend({

		open: function(filename, callback)
		{
		var
			me = this,
			url = '/file?n=' + encodeURIComponent(this.path + '/' + filename),
			fn = function(file)
			{
				me.on_file(file, callback);
			}
		;
			j5ui.get(url, fn);
		},

		on_file: function(file, callback)
		{
			if (file.success)
			{
				callback(new ide.File(file));
			}
			else
				throw new Error("Could not open file: " + file.filename);
		},

		on_project: function(w)
		{
			j5ui.extend(this, w);

			this.files_text = this.files.join("\n");
			this.fire('load');
		},

		init: function Project(name)
		{
			j5ui.Observable.apply(this);
			j5ui.get('/project' + (name ? '?n=' + name : ''), this.on_project.bind(this));
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
}),
	_start= function()
	{
	var
		hash = ide.hash.data
	;
		ide.workspace = new ide.Workspace();
		ide.info = new ide.Info();

		ide.project = new ide.Project(hash.project);
		ide.project.on('load', _on_project);
	},

	_on_project= function()
	{
		ide.plugins.start();
		j5ui.id('mask').style.display = 'none';

		if (ide.hash.data.file)
			ide.open(ide.hash.data.file);
	}
;

	ide.plugins = new ide.PluginManager();
	ide.hash = new ide.Hash();
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

	ide.Bar = j5ui.Widget.extend({

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

		init: function Bar()
		{
			j5ui.Widget.apply(this);

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
				el = this.element,
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
		
			this.on('keyup', this.on_key);
			this.on('keydown', this.on_keydown);
			this.on('blur', this.on_blur);
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
			
			if (this.element.value!==this._value)
			{
				this._lastSearch = null;
				if (this.on_change)
					this.on_change(this.element.value);
			}

			this._value = this.element.value;
			ev.stopPropagation();
			return false;
		},

		keys: function(k)
		{
			j5ui.extend(this._keys, k);
		},
		
		show: function()
		{
			this.element.value = '';
			this.element.style.display = 'block';
			this.hidden = false;
			this.focus();
		},

		focus: function()
		{
		var
			el = this.element
		;
			j5ui.refer(function() { el.focus(); });
		},

		hide: function()
		{
			this.element.style.display = 'none';
			this.hidden = true;
			if (ide.editor)
				ide.editor.focus();
			return false;
		},
		
		start: function()
		{
			document.body.appendChild(this.element);
		}

	});

	ide.Bar.Command = ide.Bar.extend({

		element: j5ui.html('<input id="command" />'),
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
			val = this.element.value,
			cmd
		;
			if (val==='')
				return;

			cmd = this.parse(val);

			if (!cmd.fn)
				j5ui.alert('Unknown Command: ' + val);
			else
				cmd.fn.apply(cmd.scope, cmd.args);

			window.console.log(val);
		},
		
		on_complete: function(s, start, end)
		{
		var
			val = this.element.value,
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
			this._value = this.element.value = val.slice(0, start) + match + val.slice(end);
		}

	});

	ide.Bar.Evaluate = ide.Bar.extend({
		
		shortcut: 'shift-49',
		element: j5ui.html('<input id="evaluate" />'),
		
		encode: function(response)
		{
			return response.toString().replace(/&/g, '&amp;').replace(/</g, '&lt;');
		},
		
		run: function()
		{
		/*jshint evil: true */
		var
			response = eval(this.element.value)
		;
			if (response === undefined)
				return;
				
			j5ui.info(response);
		}
		
	});

	ide.Bar.Search = ide.Bar.extend({
		
		element: j5ui.html('<input id="search" />'),
		shortcut: '191',

		run: function()
		{
			//ide.editor.editor.findAll(new RegExp(this.element.value));
		},

		on_change: function(val)
		{
		var
			regex
		;
			try { regex = new RegExp(val); } catch(e) { regex = val; }

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
			j5ui.error(error.message);
			window.console.error(error);
		},

		start: function()
		{
			window.addEventListener('error', this._error.bind(this));
		}

	}));

})(this, this.j5ui, this.Backbone);
