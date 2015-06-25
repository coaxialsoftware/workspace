
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
	mode: null,

	// Stores previous token. Used by tokenchange event.
	_old_token: null,

	commands: {

		w: function(filename)
		{
			this.write(filename);
		},

		ascii: function()
		{
		var
			char = this.get_char(),
			code = char.charCodeAt(0)
		;
			ide.notify(char + ': ' + code + ' 0x' + code.toString(16) + ' 0' + code.toString(8));
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
		var pos = this.editor.getCursorPosition();
		pos.index = this.editor.session.doc.positionToIndex(pos);

		return pos;
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
		session = editor.getSession(),
		s = ide.project.get('editor') || {}
	;
		ace.config.set('basePath', 'ace-builds/src');
		editor.setTheme(s.theme || 'ace/theme/twilight');
		editor.container.style.fontSize = s.font_size || '16px';
		editor.setKeyboardHandler(s.bindings || 'ace/keyboard/vim');
		editor.setBehavioursEnabled(true);
		editor.setDisplayIndentGuides(s.indent_guides || false);

		session.setUseSoftTabs(s.indent_style==='space');
		session.setUseWrapMode(true);
		session.setValue(this.file.get('content'));
		session.setTabSize(s.indent_size || 4);

		editor.selection.clearSelection();
		editor.on('focus', this.on_focus.bind(this));
		editor.on('blur', this.on_blur.bind(this));

		editor.on('changeSelection', this.on_selection.bind(this));
		editor.renderer.scrollBar.element.addEventListener('scroll',
			this.on_scroll.bind(this)
		);

		this.set_mode();
		this.$el.on('keydown', this.on_keyup.bind(this));

		this.file.on('write', this.trigger.bind(this, 'write'));

		window.setTimeout(this.focus.bind(this), 250);
		this.findNextFix();
		this.enable_autocompletion();
		this.registers = require('ace/keyboard/vim/registers');
	},

	resize: function()
	{
		setTimeout(this.editor.resize.bind(this.editor), 200);
	},

	on_blur: function()
	{
		this.plugin.data('clipboard', this.registers._default.text);
	},

	findNextFix: function()
	{
		this.editor.findNext = function(options, animate)
		{
			this.find({skipCurrent: true, backwards: false, start:null},
				options, animate);
		};
	},

	/**
	 * Gets token at pos. If pos is ommited it will return the token
	 * under the cursor
	 */
	get_token: function(pos)
	{
	var
		insertMode = this.get_state()==='insertMode',
		token, col
	;
		pos = pos || this.editor.getCursorPosition();
		col = pos.column + (insertMode ? 0 : 1);

		token = this.editor.session.getTokenAt(pos.row, col);

		return token;
	},

	get_char: function(pos)
	{
		pos = pos || this.editor.getCursorPosition();

		return this.editor.session.getTextRange({ start: pos, end:
			{ row: pos.row, column: pos.column+1 }});
	},

	/**
	 * Gets cursor position and dimension
	 */
	get_cursor: function()
	{
		return this.editor.renderer.$cursorLayer.cursor;
	},

	get_selection: function()
	{
		return this.editor.session.getSelection();
	},

	get_font: function()
	{
		return this.$el.css('font');
	},

	on_selection: function(ev, editor)
	{
	var
		insertMode = this.get_state()==='insertMode',
		pos = editor.getCursorPosition(),
		ann = this.get_annotation(pos.row),
		token = this.get_token(pos)
	;
		if (ann && !insertMode)
			ide.info.show(ann.text.join('<br/>'));

		if (token !== this.__token)
		{
			ide.trigger('tokenchange', this, token, pos);
			this.__token = token;
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

		var cb = this.plugin.data('clipboard');

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
		if (!force && this.changed())
			return "File has changed. Are you sure?";

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

	insert: function(text)
	{
		this.editor.insert(text);
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
			' [' + this.file.get('project') + ']';
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

	edit: function(file, options)
	{
		if (!file.get('directory'))
		{
		var
			editor = new ide.Editor.Source({
				slot: options.slot,
				plugin: this,
				file: file
			})
		;
			if (!file.attributes.content)
				file.set('content', '');

			if (options && options.line)
				setTimeout(function() {
					editor.editor.gotoLine(options.line);
				});

			ide.workspace.add(editor);

			return true;
		}
	}

}));

})(this.ide, this.ace, this.require);
