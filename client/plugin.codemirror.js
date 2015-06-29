
(function(ide, cxl, codeMirror) {
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
			return function() { this.go(fn); };

		return this.commands[fn];
	},

	go: function(n)
	{
		this.editor.setCursor(n-1);
	},

	get_value: function()
	{
		return this.editor.getValue(this.line_separator);
	},

	/*get_position: function()
	{
		var pos = this.editor.getCursorPosition();
		pos.index = this.editor.session.doc.positionToIndex(pos);

		return pos;
	}

*/
	find_mode: function()
	{
		var info = codeMirror.findModeByFileName(this.file.get('filename')) ||
			codeMirror.findModeByMIME(this.file.get('mime')) ||
			codeMirror.findModeByMIME('plain/text'),
			mode = info.mode,
			me = this
		;
			function getScript(mode)
			{
				return 'codemirror/mode/' + mode + '/' + mode + '.js';
			}
		
			if (!codeMirror.modes[mode])
			{
				if (info.require)
					ide.loader.script(getScript(info.require));
					
				ide.loader.script(getScript(mode));
				ide.loader.ready(function() {
					me.editor.setOption('mode', mode);
				});
				return;
			}
		
		return mode;
	},

	setup: function()
	{
	var
		s = ide.project.get('editor') || {},

		ft = this.find_mode(),
		editor = this.editor = codeMirror(this.el, {
			value: this.file.get('content'),
			mode: ft,
			theme: s.theme || 'twilight',
			tabSize: s.indent_size || 4,
			indentWithTabs: s.indent_style!=='space',
			keyMap: 'vim',
			lineWrapping: true,
			lineNumbers: true,
			scrollbarStyle: 'null',
			electricChars: false,
			indentUnit: s.indent_size || 4,
			styleActiveLine: true,
			foldGutter: s.fold_gutter!==false,
			gutters: ['CodeMirror-lint-markers', "CodeMirror-linenumbers", 
				"CodeMirror-foldgutter"]	
		})
	;
		this.line_separator = s.line_separator || "\n";
		this.$el.on('keydown', this.on_keyup.bind(this));
		
		if (s.font_size)
			this.el.style.fontSize = s.font_size;

		editor.on('focus', this.on_focus.bind(this));
		editor.on('blur', this.on_blur.bind(this));
		
		this.registers = codeMirror.Vim.getRegisterController();

		//editor.on('changeSelection', this.on_selection.bind(this));
	},

	resize: function()
	{
		//setTimeout(this.editor.resize.bind(this.editor), 200);
	},
	
	find: function(n)
	{
		if (n)
			this.editor.find(n);
	},

	/**
	 * Gets token at pos. If pos is ommited it will return the token
	 * under the cursor
	 */
	
	get_token: function(pos)
	{
		pos = pos || this.editor.getCursor();

		return this.editor.getTokenAt(pos, true);
	},

	get_char: function(pos)
	{
		pos = pos || this.editor.getCursor();

		return this.editor.getRange(pos, 
			{ line: pos.line, ch: pos.ch+1 });
	},

	/**
	 * Gets cursor element.
	 */
	/*get_cursor: function()
	{
		return this.editor.renderer.$cursorLayer.cursor;
	},*/

	get_selection: function()
	{
		return this.editor.getSelection(this.line_separator);
	},

	get_font: function()
	{
		return this.$el.css('font');
	},

	on_keyup: function(ev)
	{
		if (this.vim_mode()==='INSERT')
		{
			ev.stopPropagation();
		}
	},

	sync_registers: function()
	{
	var
		data = this.plugin.data('registers'),
		cb = data && JSON.parse(data)
	;
		for (var i in cb)
			// TODO dangerous?
			cxl.extend(this.registers.getRegister(i), cb[i]);
	},
	
	on_blur: function()
	{
		this.plugin.data('registers', JSON.stringify(this.registers));
	},

	on_focus: function()
	{
		this.focus(true);
		this.sync_registers();
	},

	focus: function(ignore)
	{
		ide.Editor.prototype.focus.apply(this);

		if (!ignore)
			this.editor.focus();

		//this.editor.resize();
	},

	close: function(force)
	{
		if (!force && this.changed())
			return "File has changed. Are you sure?";

		//this.editor.destroy();
		ide.Editor.prototype.close.call(this);
	},

	write: function(filename)
	{
		if (filename)
			this.file.set('filename', filename);
		
		if (!this.file.get('filename'))
			return ide.error('No file name.');

		this.file.set('content', this.editor.getValue());
		this.file.save();
	},

	insert: function(text)
	{
		this.editor.replaceSelection(text);
	},

	changed: function()
	{
		return this.file.get('content') !== this.get_value();
	},

	vim_mode: function()
	{
		var state = this.editor.state.vim;
		// TODO add more modes
		return state.insertMode ? 'INSERT' : 
			(state.visualMode ? 'VISUAL' : 'NORMAL');
	},

	get_info: function()
	{
		return (this.changed() ? '+ ' : '') +
			(this.file.get('filename') || '[No Name]') +
			' [' + ide.project.get('name') + ']';
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
					editor.go(options.line);
				});

			ide.workspace.add(editor);

			return true;
		}
	}

}));

})(this.ide, this.cxl, this.CodeMirror);
