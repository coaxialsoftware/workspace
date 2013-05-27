/**
 * @license
 *
 */

(function(window) {

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

		edit: function(file)
		{
			return false;
		},

		start: function() { }

	}),

	Info: j5ui.Widget.extend({

		_infoTimeout: null,

		element: '#info',

		show: function(msg)
		{
		var
			me = this
		;
			this.element.innerHTML = msg;
			this.element.style.display = 'block';

			if (this._infoTimeout)
				clearTimeout(this._infoTimeout);

			this._infoTimeout = setTimeout(function() {
				me.hide();
			}, 1000);

			return this;
		}
	}),

	Workspace: j5ui.Container.extend({

		element: '#workspace',
		layout: j5ui.Layout.Smart,

		init: function Workspace(p)
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
			this.children[0] && this.children[0].focus();
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
				plug.edit && plug.edit(file);
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
				plug.start && plug.start();
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

		register: function(name, klass)
		{
			this._plugins[name] = new klass();
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
	ide.loader = new Loader();

	window.addEventListener('load', _start);

})(this);
