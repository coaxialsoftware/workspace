
IDE.Editor = j5ui.Widget.extend({

	init: function Editor(p)
	{
		j5ui.Widget.apply(this, arguments);

	},

	on_focus: function()
	{
		ide.set_editor(this);
	},

	get_status: function()
	{
	}
		
});

IDE.Panel = j5ui.Widget.extend({
	
	css: 'ide-panel'
	
});

IDE.Bar = j5ui.Widget.extend({

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
		j5ui.refer(function() { el.focus(); });
	},

	hide: function()
	{
		this.element.style.display = 'none';
		this.hidden = true;
		if (ide.editor)
			ide.editor.focus();
		return false;
	}

});

IDE.Bar.Command = IDE.Bar.extend({

	element: j5ui.html('<input id="command" />'),
	
	run: function()
	{
		ide.eval(this.element.value);
	}

});

IDE.Bar.Evaluate = IDE.Bar.extend({
	
	element: j5ui.html('<input id="evaluate" />'),
	
	encode: function(response)
	{
		return response.toString().replace(/&/g, '&amp;').replace(/</g, '&lt;');
	},
	
	run: function()
	{
	var
		el = j5ui.dom('DIV'),
		response = eval(this.element.value)
	;
		if (response === undefined)
			return;
			
		//el.innerHTML = this.encode(response);
		//ide.workspace.add(new IDE.Panel({element: el}));
		j5ui.info(response);
	}
	
})

IDE.Bar.Search = IDE.Bar.extend({
	
	element: j5ui.html('<input id="search" />'),

	run: function()
	{
		
	},

	on_change: function(val)
	{
		if (ide.editor)
			ide.editor.find(new RegExp(val));
	}

});

IDE.Editor.Source = IDE.Editor.extend({
		
	file: null,
	editor: null,
	session: null,
	
	modeByMime: { },
	modeByExt: {
		ch: 'csharp',
		c: 'c_cpp',
		cc: 'c_cpp',
		cpp: 'c_cpp',
		cxx: 'c_cpp',
		h: 'c_cpp',
		hh: 'c_cpp',
		hpp: 'c_cpp',
		clj: 'clojure',
		js: 'javascript',
		json: 'json',
		md: 'markdown',
		php: 'php',
		php5: 'php',
		py: 'python',
		r: 'r',
		ru: 'ruby',
		rb: 'ruby',
		sh: 'sh',
		bash: 'sh',
		rhtml: 'rhtml'
	},
	modeByFile: { 
		Rakefile: 'ruby'
	},

	setup: function()
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
		session.setValue(this.file.content);

		editor.selection.clearSelection();
		editor.on('focus', this.on_focus.bind(this));

		this.set_mode();
		this.on('keyup', this._on_keyup);
		j5ui.refer(this.focus.bind(this), 250);
	},

	_on_keyup: function(ev)
	{
		if (this.get_state()==='insertMode')
		{
			ev.stopPropagation();
			return false;
		}
	},
	
	on_focus: function()
	{
		IDE.Editor.prototype.on_focus.apply(this);
		this.editor.resize();
	},
	
	find: function(n)
	{
		this.editor.find(n);
	},

	focus: function()
	{
		this.editor.focus();
	},

	close: function()
	{
		this.editor.destroy();
		this.remove();
		this.fire('close', [ this ]);
	},

	write: function()
	{
		this.file.content = this.editor.getValue();
		this.file.save();
	},
	
	get_state: function()
	{
		return this.editor.keyBinding.$data.state;
	},

	get_status: function()
	{
		return this.editor.$vimModeHandler.getStatusText();
	},

	set_mode: function()
	{
	var
		mode = this.modeByMime[this.file.mime] ||
			this.modeByExt[this.file.ext] ||
			this.modeByFile[this.file.filename] ||
			this.file.mime.split('/')[1]
	;

		this.editor.session.setMode('ace/mode/' + mode);
	}

});

ide.plugin('editor.source', {
	
	editors: [],
	
	edit: function(file)
	{
	var
		editor = new IDE.Editor.Source({ file: file })
	;
		this.editors.push(editor);
		editor.on('close', this.on_close.bind(this));
		ide.workspace.add(editor);
	},

	on_close: function(editor)
	{
		this.editors.splice(this.editors.indexOf(editor), 1);
	},

	cmd: function(cmd)
	{
	var
		l = this.editors.length,
		editor
	;
		while (l--)
			if (ide.editor===this.editors[l])
			{
				editor = this.editors[l];
				
				if (cmd[0]==='w')
					editor.write();
				else if (cmd[0]==='q')
					editor.close();
				else if (!isNaN(cmd[0]))
					editor.editor.gotoLine(cmd[0]);
				else
					return;

				return true;
			}
	}

});

ide.plugin('eval', {
	
	shortcut: 'shift-49',
	
	invoke: function()
	{
		this.bar.show();
	},
	
	setup: function()
	{
		this.bar = new IDE.Bar.Evaluate();
		document.body.appendChild(this.bar.element);
	}
	
});

ide.plugin('search', {
	
	shortcut: '191',
	
	invoke: function()
	{
		this.bar.show();
	},
	
	setup: function()
	{
		this.bar = new IDE.Bar.Search();
		document.body.appendChild(this.bar.element);
	}
	
});

ide.plugin('command', {
	
	shortcut: "shift-186",

	invoke: function()
	{
		this.bar.show();
	},
	
	setup: function()
	{
		this.bar = new IDE.Bar.Command();
		document.body.appendChild(this.bar.element);
	}

});

ide.plugin('error', {
	
	_error: function(error, url, line)
	{
		j5ui.error(error.message);
		console.error(error);
	},

	setup: function()
	{
		window.addEventListener('error', this._error.bind(this));
	}

});

ide.plugin('welcome', {
	
	setup: function()
	{
		j5ui.alert('Welcome ' + ide.project.env.USER);
	}
})