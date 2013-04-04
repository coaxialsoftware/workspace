

window.IDE = j5ui.Class.extend({

	project: null,
	workspace: null,
	plugins: null,

	set_editor: function(editor)
	{
		this.editor = editor;
		document.title = this.project.name + ' - ' + editor.file.filename;
	},

	_on_project: function()
	{
		this.plugins.setup();

		j5ui.id('mask').style.display = 'none';
	},

	_start: function()
	{
		this.project = new IDE.Project();
		this.project.on('load', this._on_project.bind(this));
		this.workspace = new IDE.Workspace();
	},

	init: function IDE()
	{
		this.plugins = new IDE.PluginManager(this);
		window.addEventListener('load', this._start.bind(this));
	},

	/**
	 * Registers plugin
	 */
	plugin: function(name, klass)
	{
		this.plugins.register(name, IDE.Plugin.extend(klass));
	},

	eval: function(val)
	{
	var
		parse = val.split(/\s/),
		cmd = this[parse[0]]
	;
		if (typeof cmd === 'function')
		{
			cmd.apply(this, parse);
		}
		else if (!isNaN(val))
			project.editor && project.editor.editor.gotoLine(val);
		else
			j5ui.alert('Unknown Command: ' + val);

		console.log(val);
	},

	edit: function()
	{
		for (i=1; i<arguments.length; i++)
			this.project.open(arguments[i], this.edit_file.bind(this));
	},

	edit_file: function(file)
	{
		this.plugins.edit(file);
	},

	tabe: function()
	{
		this.edit.apply(this, arguments);
	},

	q: function(p)
	{
		if (project.editor)
			project.editor.close();
	},

	w: function() { ide.editor.write(); },

	e: function() { this.file.load(); }

}, {
	
	Plugin: j5ui.Class.extend({
	
		shortcut: null,
		invoke: null,
		
		init: function Plugin(ide)
		{
		},

		edit: function(file)
		{
			return false;
		},

		setup: function()
		{
		},

		cmd: function(command)
		{
		}

	}),
	
	Workspace: j5ui.Container.extend({

		element: '#workspace',
		layout: j5ui.Layout.HBox,

	}),

	File: j5ui.Observable.extend({

		save: function()
		{
			j5ui.post(
				'/file?n=' + encodeURIComponent(this.filename), 
				{ content: this.editor.getValue() }, 
				this.on_write.bind(this)
			);
		}

	}),

	Project: j5ui.Observable.extend({

		open: function(filename, callback)
		{
		var
			me = this,
			url = '/file?n=' + encodeURIComponent(filename),
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
				callback(new IDE.File(file));	
			}
			else
				throw new Error("Could not open file: " + file.filename);
		},

		on_project: function(w)
		{
			j5ui.extend(this, w);
			this.fire('load');
		},

		init: function Project()
		{
			j5ui.Observable.apply(this);
			j5ui.get('/project', this.on_project.bind(this));
		}

	}),

	PluginManager: j5ui.Class.extend({
	
		_plugins: null,
		ide: null,
	
		init: function PluginManager(ide)
		{
			this.ide = ide;
			this._plugins = {};
		},

		each: function(fn)
		{
			for (var i in this._plugins)
				fn.bind(this)(this._plugins[i]);
		},
	
		edit: function(file)
		{
			this.each(function(plug) {
				plug.edit(file);
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
			key = this.get_shortcut(ev);
		;
			this.each(function(plug)
			{
				if (plug.shortcut===key)
					plug.invoke();
			});
		},
		
		setup: function()
		{
			window.addEventListener('keyup', this.on_key.bind(this));
			this.each(function(plug) {
				plug.setup();
			});
		},
		
		register: function(name, klass)
		{
			this._plugins[name] = new klass(this.ide);
		}

	})
});

var ide = new IDE();
