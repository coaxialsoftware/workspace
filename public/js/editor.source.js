
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
