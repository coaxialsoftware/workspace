
j5ui(function()
{
var
	refer = function(fn)
	{
		setTimeout(fn, 100);
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

		init: function Bar()
		{
			j5ui.Widget.apply(this);

			this._keys = {
			// TODO Use Key constants
			27: function() { this.hide(); },
			13: function() { this.run(); this.hide(); },
			8: function() {
				if (this.element.value==='')
					this.hide();
				}
			};

			this.on('keyup', this.on_key, this);
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
				this._value = this.element.value;
			}

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
		var
			val = this.element.value,
			parse = val.split(/\s/),
			cmd = Commands[parse[0]]
		;
			if (cmd)
				cmd.apply(project, parse);
			else
				j5ui.alert('Unknown Command: ' + val);
		}

	}),

	SearchBar = Bar.extend({
		element: '#search',

		run: function()
		{
			
		},

		on_change: function(val)
		{
			project.editor.find(new RegExp(val));
		}
		
	}),

	Editor = j5ui.Widget.extend({
		
	}, {
	}),

	File = Editor.extend({
		
		filename: null,
		filetype: null,
		editor: null,
		session: null,

		show_command: function(char)
		{
			if (char===':')
				project.command.show();
			else if (char==='/')
				project.search.show();
		},

		init: function File(filename)
		{
		var
			editor = this.editor = ace.edit('editor'),
			session = editor.getSession()
		;
			this.filename = filename;
			this.file = new File(hash);

			editor.setTheme('ace/theme/twilight');
			editor.container.style.fontSize = '16px';
			editor.setKeyboardHandler('ace/keyboard/vim');
			editor.showCommandLine = this.show_command.bind(this);

			editor.on('focus', this.on_focus.bind(this));
		},

		load: function()
		{
			j5ui.get('/file/' + this.filename, this.on_file.bind(this));
		},

		write: function()
		{
			j5ui.post(
				'/file/' + this.filename, 
				{ content: project.editor.getValue() }, 
				this.on_write.bind(this)
			);
		},

		on_file: function(res)
		{
			this.editor.setValue(res.content);
			this.editor.selection.clearSelection();
		},

		on_write: function(content)
		{
			j5ui.info('File saved.');
		},

		on_focus: function()
		{
			project.set_editor(this);
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
	/*
		w: function() { this.file.write(); },
		e: function() { this.file.load(); },
		tabe: function(action, filename)
		{
			//window.open('/#' + filename);
		}
		*/
	},

	KeyBindings = {
		

	},

	Project = j5ui.Class.extend({

		config: null,
		command: null,
		search: null,

		_mask: null,

		set_editor: function(editor)
		{
			this.editor = editor;
			document.title = this.config.name + ' - ' + editor.filename;
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
			} else
				console.log('Project.on_key', ev);
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
			this._mask = j5ui.id('mask');
			this.hash = new Hash();

			this.init_events();

			j5ui.get('/project/', this.on_project.bind(this));
		}

	}),

	project = window.project = new Project()
;


});
