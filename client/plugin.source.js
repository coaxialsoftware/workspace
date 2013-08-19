
(function(ide, j5ui, ace) {
"use strict";

ide.Editor.Source = ide.Editor.extend({

	file: null,
	editor: null,
	session: null,
	mode: null,

	// Stores previous token. Used by tokenchange event.
	_old_token: null,

	modeByMime: {
		"text/plain": "text"
	},
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
		rhtml: 'rhtml',
		txt: 'text'
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

	get_value: function()
	{
		return this.editor.getValue();
	},

	get_position: function()
	{
		return this.editor.getCursorPosition();
	},

	setup: function()
	{
	var
		editor = this.editor = ace.edit(this.element),
		session = editor.getSession()
	;
		ace.config.set('basePath', 'ace/build/src');
		editor.setTheme('ace/theme/twilight');
		editor.container.style.fontSize = '16px';
		editor.setKeyboardHandler('ace/keyboard/vim');
		editor.setBehavioursEnabled(true);
		editor.setDisplayIndentGuides(false);

		session.setUseSoftTabs(false);
		session.setUseWrapMode(true);
		session.setValue(this.file.content);

		//session.on('changeAnnotation', this.on_annotation.bind(this));

		editor.selection.clearSelection();
		editor.on('focus', this.on_focus.bind(this));
		editor.on('changeSelection', this.on_selection.bind(this));

		window.addEventListener('beforeunload', this.on_beforeunload.bind(this));

		this.set_mode();
		this.on('keyup', this.on_keyup);
		j5ui.refer(this.focus.bind(this), 250);
	},

	on_beforeunload: function()
	{
		this.close();
	},

	on_selection: function(ev, editor)
	{
	var
		pos = editor.getCursorPosition(),
		ann = this.get_annotation(pos.row),
		token = editor.session.getTokenAt(pos.row, pos.column)
	;
		if (ann)
			ide.info.show(ann.text.join('<br/>'));

		if (token !== this._old_token)
		{
			ide.fire('tokenchange', [ this, token ]);
			this._old_token = token;
		}
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

	get_annotation: function(row)
	{
		return this.editor.renderer.$gutterLayer.$annotations[row];
	},

	find: function(n)
	{
		this.editor.find({ needle: n });
	},

	focus: function()
	{
		this.editor.focus();
	},

	close: function()
	{
		if (this.changed() && !window.confirm("File has changed. Are you sure?"))
			return;

		this.editor.destroy();
		this.remove();
		this.fire('close', [ this ]);
	},

	remove_trailing: function()
	{
		this.editor.replaceAll('', { needle: /[\t ]+$/ });
	},

	write: function()
	{
	var
		annotations = this.editor.session.getAnnotations()
	;
		if (this.mode==='javascript')
			this.remove_trailing();

		this.file.content = this.editor.getValue();
		this.file.save();

		annotations.forEach(function(a) {
			j5ui.alert((a.row+1) + ': ' + a.text);
		});
	},

	changed: function()
	{
		return this.file.content !== this.editor.getValue();
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
		mode = this.mode = this.modeByFile[this.file.filename] ||
			this.modeByMime[this.file.mime] ||
			this.modeByExt[this.file.ext] ||
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

})(this.ide, this.j5ui, this.ace);
