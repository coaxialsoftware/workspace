
j5ui(function()
{
var
	refer = function(fn)
	{
		setTimeout(fn, 100);
	},

	Command = j5ui.Widget.extend({

		element: '#command',

		run: function()
		{
		var
			cmd = this.element.value.split(/\s/)
		;
			console.log(cmd);
		},

		init: function Command()
		{
			j5ui.Widget.apply(this);
			this.on('keypress', this.on_key, this);
			this.on('keydown', this.on_key, this);
		},

		on_key: function(ev)
		{
			if (ev.keyCode===27) 
			{
				this.hide();
				return false;
			} else if (ev.keyCode===9)
				return false;
			else if (ev.keyCode===13)
			{
				this.run();
				this.hide();
				return false;
			} else if (ev.keyCode===27) {
				this.hide();
				return false;
			}
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

	Search = Command.extend({
		element: '#search',

		init: function Search()
		{
			Command.apply(this);
			this.on('keyup', this.on_keyup, this);
		},

		on_keyup: function(ev)
		{
			if (this.element.value!==this._value)
			{
				project.editor.find(new RegExp(this.element.value));
				this._value = this.element.value;
			}
		}
		
	}),

	Project = j5ui.Class.extend({

		config: null,
		command: null,
		search: null,
		editor: null,
		session: null,
		filename: null,

		_mask: null,

		commands: {
			w: function() {
				this.write();
			}
		},

		write: function()
		{
			this.mask();
			j5ui.post(
				'/file/' + this.filename, 
				{ content: this.editor.getValue() }, 
				this.on_write.bind(this)
			);
		},

		on_write: function(content)
		{
			console.log(content);
			this.unmask()
		},
		
		on_file: function(content)
		{
			this.editor.setValue(content);
		},

		on_hash: function(ev, a)
		{
		var
			hash = location.hash.substr(1)
		;
			document.title = hash;
			j5ui.get('/file/' + hash, this.on_file.bind(this));
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
			this.filename = hash;

			editor.setTheme('ace/theme/twilight');
			editor.container.style.fontSize = '16px';
			editor.setKeyboardHandler('ace/keyboard/vim');
			editor.showCommandLine = this.command_line.bind(this);

			session.setMode('ace/mode/javascript');

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
		
		init: function Project()
		{
			this.command = new Command();
			this.search = new Search();
			this._mask = j5ui.id('mask');
			this.init_hash();
			this.init_editor();
		}

	}),

	project = window.project = new Project()
;


});
