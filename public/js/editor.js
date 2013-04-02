
j5ui(function()
{
var
	refer = function(fn)
	{
		setTimeout(fn, 100);
	},

	Command = j5ui.Class.extend({
		
	}),

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

			this.on('keypress', this.on_key_press, this);
			this.on('keydown', this.on_key, this);
		},

		on_key_press: function(ev)
		{
			if (this.on_key(ev)!==false &&
				this.on_change &&
				this.element.value!==this._value
			) {
				this.on_change(this.element.value);
				this._value = this.element.value;
			}
		},

		on_key: function(ev)
		{
		var
			fn = this._keys[ev.keyCode]
		;
			if (fn)
			{
				fn.apply(this, [ ev ]);
				return false;
			}
		},

		keys: function(k)
		{
			j5ui.extend(this._keys, k);
		},
		
		show: function()
		{
			this.element.value = '';
			this.element.style.display = 'block';
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
			project.editor.focus();
			return false;
		}
	}),

	CommandBar = Bar.extend({

		element: '#command',

		run: function()
		{
		var
			parse = this.element.value.split(/\s/),
			cmd = project.commands[parse[0]]
		;
			if (cmd)
				cmd.apply(project, parse);
			else
				j5ui.alert('Unknown Command: ' + parse);
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

	File = j5ui.Class.extend({
		
		filename: null,

		init: function File(filename)
		{
			this.filename = filename;
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

		on_file: function(content)
		{
			project.editor.setValue(content);
		},

		on_write: function(content)
		{
			j5ui.info('File saved.');
		}
		
	}),

	Project = j5ui.Class.extend({

		config: null,
		command: null,
		search: null,
		editor: null,
		session: null,

		_mask: null,

		commands: {
			w: function() { this.file.write(); },
			e: function() { this.file.load(); },
			tabe: function(action, filename)
			{
				window.open('/#' + filename);
			}
		},

		on_hash: function(ev, a)
		{
		var
			hash = location.hash.substr(1)
		;
			this.file = new File(hash);
			this.file.load();
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
		var
			editor = this.editor
		;
			this.config = w;
			editor.setValue(w.content);
			editor.selection.clearSelection();

			this.unmask();
			editor.focus();
		},

		init_editor: function()
		{
		var
			editor = this.editor = ace.edit('editor'),
			session = editor.getSession(),
			hash = location.hash.substr(1)
		;
			this.file = new File(hash);
			document.title = hash || 'Untitled';

			editor.setTheme('ace/theme/twilight');
			editor.container.style.fontSize = '16px';
			editor.setKeyboardHandler('ace/keyboard/vim');
			editor.showCommandLine = this.command_line.bind(this);

			//session.setMode('ace/mode/javascript');

			j5ui.get('/project/' + hash, this.on_project.bind(this));
		},

		command_line: function(val)
		{
			if (val===':')
				this.command.show();
			else if (val==='/')
				this.search.show();
		},

		init_hash: function()
		{
			window.addEventListener(
				'hashchange', this.on_hash.bind(this)
			);
		},

		on_error: function(msg, url, line)
		{
			j5ui.error(msg);
			console.error(msg);
		},

		init_events: function()
		{
			window.addEventListener('error', this.on_error.bind(this));
		},
		
		init: function Project()
		{
			this.command = new CommandBar();
			this.search = new SearchBar();
			this._mask = j5ui.id('mask');

			this.init_hash();
			this.init_editor();
			this.init_events();
		}

	}),

	project = window.project = new Project()
;


});
