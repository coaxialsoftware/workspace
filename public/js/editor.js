
j5ui(function()
{
var
	refer = function(fn, t)
	{
		setTimeout(fn, t || 100);
	},

	Bar = j5ui.Widget.extend({
	
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
				this.on_complete && this.on_complete();
			}
			};

			this.on('keyup', this.on_key);
			this.on('keydown', this.on_keydown);
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
			{
				fn.apply(this, [ ev ]);
			} else if (
				this.on_change && 
				this.element.value!==this._value
			) {
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
			refer(function() { el.focus(); });
		},

		hide: function()
		{
			this.element.style.display = 'none';
			this.hidden = true;
			if (project.editor)
				project.editor.focus();
			return false;
		}
	}),

	CommandBar = Bar.extend({

		element: '#command',

		run: function()
		{
			Commands.run(this.element.value);
		}

	}),

	SearchBar = Bar.extend({
		element: '#search',

		run: function()
		{
			
		},

		on_change: function(val)
		{
			project.editor.editor.find(new RegExp(val));
		}
		
	}),

	Editor = j5ui.Widget.extend({

		init: function Editor(p)
		{
			j5ui.Widget.apply(this, arguments);

		},

		on_focus: function()
		{
			project.set_editor(this);
		},

		get_status: function()
		{
		}
		
		
	}, {
		create: function(filename, el)
		{
			return new FileEditor({ filename: filename, element: el });
		}
	}),

	FileEditor = Editor.extend({
		
		filename: null,
		filetype: null,
		editor: null,
		session: null,
		modes: {
		},

		show_command: function(char)
		{
			if (char===':')
				project.command.show();
			else if (char==='/')
				project.search.show();
		},

		setup: function File()
		{
		var
			editor = this.editor = ace.edit(this.element),
			session = editor.getSession()
		;
			editor.setTheme('ace/theme/twilight');
			editor.container.style.fontSize = '16px';
			editor.setKeyboardHandler('ace/keyboard/vim');
			editor.setBehavioursEnabled(true);
			editor.setDisplayIndentGuides(false);
			
			session.setUseSoftTabs(false);
			editor.showCommandLine = this.show_command.bind(this);

			editor.on('focus', this.on_focus.bind(this));
console.log(this.filename);
			if (this.filename)
				this.load();
		},

		focus: function()
		{
			this.editor.focus();
			this.editor.resize();
		},

		load: function()
		{
			j5ui.get('/file?n=' + encodeURIComponent(this.filename), this.on_file.bind(this));
		},

		close: function()
		{
			this.editor.destroy();
			this.remove();
		},

		write: function()
		{
			j5ui.post(
				'/file?n=' + encodeURIComponent(this.filename), 
				{ content: this.editor.getValue() }, 
				this.on_write.bind(this)
			);
		},

		get_status: function()
		{
			return this.editor.$vimModeHandler.getStatusText();
		},

		set_mode: function()
		{
		var
			mode = this.modes[this.mime]
		;
			if (!mode)
				mode = 'ace/mode/' + this.mime.split('/')[1];

			this.editor.session.setMode(mode);
		},

		on_file: function(res)
		{
			this.editor.setValue(res.content.toString());
			this.editor.selection.clearSelection();
			this.mime = res.mime;
			this.filename = res.filename;
			this.set_mode();
		},

		on_write: function(content)
		{
			j5ui.info('File saved.');
		}

	}),

	/**
	 * Handles URL Hash
	 */
	Hash = j5ui.Class.extend({

		on_hash: function(ev, a)
		{
		/*var
			hash = location.hash.substr(1)
		;
			this.file = new File(hash);
			this.file.load();
			*/
		},

		init: function Hash()
		{
			window.addEventListener(
				'hashchange', this.on_hash.bind(this)
			);
		}
	}),

	Commands = {
		
		run: function(val)
		{
		var
			parse = val.split(/\s/),
			cmd = Commands[parse[0]]
		;
			if (cmd)
			{
				cmd.apply(project, [ parse ]);
			}
			else if (!isNaN(val))
				project.editor && project.editor.editor.gotoLine(val);
			else
				j5ui.alert('Unknown Command: ' + val);

			console.log(val);
		},

		tabe: function(p)
		{
			project.workspace.edit(p[1]);
		},

		q: function(p)
		{
			if (project.editor)
				project.editor.close();
		},

		w: function() { project.editor.write(); }
	/*
		e: function() { this.file.load(); },
		*/
	},

	KeyBindings = {
		

	},

	Workspace = j5ui.Container.extend({

		element: '#workspace',

		setup: function()
		{
		},

		layout: j5ui.Layout.HBox,

		edit: function(filename)
		{
		var
			div = j5ui.dom('DIV'),
			editor = Editor.create(filename, div)
		;
			this.add(editor);
			refer(function() { editor.focus(); }, 350);
		}

	}),

	Project = j5ui.Class.extend({

		config: null,
		command: null,
		search: null,
		workspace: null,

		_mask: null,
		_info: null,

		set_editor: function(editor)
		{
		var
			status = editor.get_status()
		;
			this.editor = editor;
			document.title = this.config.name + ' - ' + editor.filename;
			this._info.innerHTML = editor.filename + (status ? ': ' + status : '');
		},

		mask: function()
		{
			this._mask.style.display = 'block';
		},

		unmask: function()
		{
			this._mask.style.display = 'none';
		},

		on_project: function(w)
		{
			this.config = w;
			
			document.title = this.config.name;

			this.unmask();
		},

		on_error: function(msg, url, line)
		{
			j5ui.error(msg);
			console.error(msg);
		},

		on_key: function(ev)
		{
			if (ev.shiftKey)
			{
				if (ev.keyCode===186)
					this.command.show();
			} 
		},

		init_events: function()
		{
			window.addEventListener('error', this.on_error.bind(this));
			window.addEventListener('keyup', this.on_key.bind(this));
		},
		
		init: function Project()
		{
			this.commands = Commands;

			this.command = new CommandBar();
			this.search = new SearchBar();
			this.hash = new Hash();
			this.workspace = new Workspace();

			this._mask = j5ui.id('mask');
			this._info = j5ui.id('info');

			this.init_events();

			j5ui.get('/project/', this.on_project.bind(this));
		}

	}),

	project = window.project = new Project()
;


});
