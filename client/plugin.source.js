
(function(ide, ace, require) {
"use strict";

/**
 * Events:
 *
 * tokenchange
 * cursorchange
 */
ide.Editor.Source = ide.Editor.extend({

	editor: null,
	session: null,
	mode: null,

	// Stores previous token. Used by tokenchange event.
	_old_token: null,

	commands: {

		w: function(filename)
		{
			this.write(filename);
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

	enable_autocompletion: function()
	{
		this.editor.commands.addCommand({
			name: 'startAutocomplete',
			bindKey: 'Ctrl-Space|Alt-Space',
			exec: function(editor)
			{
				ide.trigger('autocomplete', editor);
			}
		});
	},

	on_scroll: function()
	{
		ide.trigger('scroll', this);
	},

	setup: function()
	{
	var
		editor = this.editor = ace.edit(this.el),
		session = editor.getSession()
	;
		ace.config.set('basePath', 'ace-builds/src');
		editor.setTheme('ace/theme/twilight');
		editor.container.style.fontSize = '16px';
		editor.setKeyboardHandler('ace/keyboard/vim');
		editor.setBehavioursEnabled(true);
		editor.setDisplayIndentGuides(false);

		session.setUseSoftTabs(false);
		session.setUseWrapMode(true);
		session.setValue(this.file.get('content'));

		editor.selection.clearSelection();
		editor.on('focus', this.on_focus.bind(this));
		editor.on('blur', this.on_blur.bind(this));

		editor.on('changeSelection', this.on_selection.bind(this));
		editor.renderer.scrollBar.element.addEventListener('scroll', this.on_scroll.bind(this));

		window.addEventListener('beforeunload', this.on_beforeunload.bind(this));

		this.set_mode();
		this.$el.on('keydown', this.on_keyup.bind(this));

		this.file.on('write', this.trigger.bind(this, 'write'));
		ide.workspace.on('layout', this.editor.resize, this.editor);

		window.setTimeout(this.focus.bind(this), 250);
		this.findNextFix();
		this.enable_autocompletion();
		this.registers = require('ace/keyboard/vim/registers');
	},

	on_blur: function()
	{
		window.localStorage['ide.plugin.source.clipboard'] = this.registers._default.text;
	},

	findNextFix: function()
	{
		this.editor.findNext = function(options, animate)
		{
			this.find({skipCurrent: true, backwards: false, start:null},
				options, animate);
		};
	},

	on_beforeunload: function()
	{
		if (this.close()===false)
			return 'File has changed. Are you sure?';
	},

	on_selection: function(ev, editor)
	{
	var
		pos = editor.getCursorPosition(),
		ann = this.get_annotation(pos.row),
		token = editor.session.getTokenAt(pos.row, pos.column+1)
	;
		if (ann && this.get_state() !== 'insertMode')
			ide.info.show(ann.text.join('<br/>'));

		if (token !== this._old_token)
		{
			ide.trigger('tokenchange', this, token, pos);
			this._old_token = token;
		}

		ide.trigger('cursorchange', this, pos);
	},

	on_keyup: function(ev)
	{
		if (this.get_state()==='insertMode')
		{
			ev.stopPropagation();
		}
	},

	on_focus: function()
	{
		this.focus(true);

		var cb = window.localStorage['ide.plugin.source.clipboard'];

		if (this.registers._default.text !== cb)
		{
			this.registers._default.text = cb;
		}
	},

	get_annotation: function(row)
	{
		return this.editor.renderer.$gutterLayer.$annotations[row];
	},

	find: function(n)
	{
		this.editor.find({ needle: n });
		this.editor.$search.$options.start = null;
	},

	focus: function(ignore)
	{
		ide.Editor.prototype.focus.apply(this);

		if (!ignore)
			this.editor.focus();

		this.editor.resize();
	},

	close: function(force)
	{
		if (!force && this.changed() && !window.confirm("File has changed. Are you sure?"))
			return false;

		this.editor.destroy();
		ide.Editor.prototype.close.call(this);
	},

	remove_trailing: function()
	{
		this.editor.replaceAll('', { needle: /[\t ]+$/ });
	},

	write: function(filename)
	{
	var
		annotations = this.editor.session.getAnnotations()
	;
		if (filename)
			this.file.set('filename', filename);
		if (this.mode==='javascript')
			this.remove_trailing();
		if (!this.file.get('filename'))
			return ide.error('No file name.');

		this.file.set('content', this.editor.getValue());
		this.file.save();

		annotations.forEach(function(a) {
			ide.alert((a.row+1) + ': ' + a.text);
		});
	},

	changed: function()
	{
		return this.file.get('content') !== this.editor.getValue();
	},

	get_state: function()
	{
		return this.editor.keyBinding.$data.vimState;
	},

	get_status: function()
	{
		return this.editor.$vimModeHandler.getStatusText();
	},

	get_info: function()
	{
		return (this.changed() ? '+ ' : '') +
			(this.file.get('filename') || '[No Name]') +
			' [' + this.file.get('path') + ']';
	},

	set_mode: function()
	{
	var
		mode = this.mode = ide.filetype(this.file)
	;
		this.editor.session.setMode('ace/mode/' + mode);
	}

});

ide.plugins.register('editor', new ide.Plugin({

	openEditor: function(file)
	{
	var
		editor = new ide.Editor.Source({ file: file })
	;
		ide.workspace.add(editor);
	},

	edit: function(file)
	{
		if (!file.get('directory'))
		{
			this.openEditor(file);
			return true;
		}
	}

}));

})(this.ide, this.ace, this.require);
