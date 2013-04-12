
ide.Editor.Source = ide.Editor.extend({
		
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

	commands: {

		q: function() 
		{
			this.close();
		},

		w: function()
		{
			this.write();
		}

	},

	cmd: function(fn)
	{
		if (!isNaN(fn))
			return function() { this.editor.gotoLine(fn); };

		return this.commands[fn];
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
		session.setUseWrapMode(true);
		session.setValue(this.file.content);
		
		session.on('changeAnnotation', this.on_annotation.bind(this));

		editor.selection.clearSelection();
		editor.on('focus', this.on_focus.bind(this));

		this.set_mode();
		this.on('keyup', this.on_keyup);
		j5ui.refer(this.focus.bind(this), 250);
	},
	
	on_annotation: function(ev, session)
	{
	},

	on_keyup: function(ev)
	{
		if (this.get_state()==='insertMode')
		{
			ev.stopPropagation();
			return false;
		}
	},
	
	on_focus: function()
	{
		ide.Editor.prototype.on_focus.apply(this);
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
	var
		annotations = this.editor.session.getAnnotations()
	;
	
		this.file.content = this.editor.getValue();
		this.file.save();
		
		annotations.forEach(function(a) {
			j5ui.alert((a.row+1) + ': ' + a.text);
		});
	},
	
	get_state: function()
	{
		return this.editor.keyBinding.$data.state;
	},

	get_status: function()
	{
		return this.editor.$vimModeHandler.getStatusText();
	},
	
	get_info: function()
	{
		return this.file.filename;
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

ide.plugins.register('editor.source', ide.Plugin.extend({
	
	editors: [],
	
	start: function()
	{
		
	},
	
	edit: function(file)
	{
	var
		editor = new ide.Editor.Source({ file: file })
	;
		this.editors.push(editor);
		editor.on('close', this.on_close.bind(this));
		ide.workspace.add(editor);
	},

	on_close: function(editor)
	{
		this.editors.splice(this.editors.indexOf(editor), 1);
	}

}));
