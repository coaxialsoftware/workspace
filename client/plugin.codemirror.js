
(function(ide, cxl, codeMirror) {
"use strict";
	
/**
 * Use to implement selection(shift) commands
 */
function select(command)
{
	return function() {
		this.editor.display.shift = true;
		this.editor.execCommand(command);
		this.editor.display.shift = false;
	};	
}

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
		
		write: 'w',

		ascii: function()
		{
		var
			char = this.get_char(),
			code = char.charCodeAt(0)
		;
			ide.notify(char + ': ' + code + ' 0x' + code.toString(16) + ' 0' + code.toString(8));
		},
		
		deleteSelection: function()
		{
			this.editor.replaceSelection('');	
		},
		
		replaceSelection: function(text)
		{
			this.editor.replaceSelection(text);
		},
		
		enableInput: function()
		{	
			this.toggleFatCursor(false);
			this.editor.setOption('disableInput', false);
		},

		disableInput: function()
		{
			// Go back one char if coming back from insert mode.
			if (this.editor.getCursor().ch>0)
				this.editor.execCommand('goCharLeft');
			
			this.toggleFatCursor(true);
			this.editor.setOption('disableInput', true);
		},
		
		selectLeft: select('goCharLeft'),
		selectUp: select('goLineUp'),
		selectDown: select('goLineDown'),
		selectRight: select('goCharRight'),
		selectLineStart: select('goLineStart'),
		selectLineEnd: select('goLineEnd'),
		selectPageDown: select('goPageDown'),
		selectPageUp: select('goPageUp'),
		
		clearSelection: function()
		{
			this.editor.setSelection(this.editor.getCursor('anchor'));
		},
		
		showCursorWhenSelecting: function()
		{
			this.editor.setOption('showCursorWhenSelecting', true);
		},
		
		selectLine: function()
		{
		var
			e = this.editor,
			anchor = e.getCursor('anchor'),
			head = e.getCursor(),
			anchorEnd = head.line>anchor.line ? 0 : e.getLine(anchor.line).length,
			headEnd = head.line>anchor.line ? e.getLine(head.line).length : 0	
		;
			e.extendSelection(
				{ line: head.line, ch: headEnd },
				{ line: anchor.line, ch: anchorEnd },
				{ extending: true }
			);
		}

	},

	cmd: function(fn, args)
	{
		if (!isNaN(fn))
			return this.go(fn);		 
		
		if (fn in codeMirror.commands)
			return codeMirror.commands[fn].call(codeMirror, this.editor);
		
		return ide.Editor.prototype.cmd.call(this, fn, args);
	},

	go: function(n)
	{
		this.editor.setCursor(n-1);
	},

	get_value: function()
	{
		return this.editor.getValue(this.options.lineSeparator);
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
	var
		filename = this.file.get('filename'),
		info = filename && (codeMirror.findModeByFileName(filename) ||
			codeMirror.findModeByMIME(this.file.get('mime'))) ||
			codeMirror.findModeByMIME('text/plain'),
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
				me.editor.setOption('mode', info.mime || mode);
			});
			return;
		}
		
		return info.mime || mode;
	},
	
	get_options: function()
	{
		var ft = this.find_mode(), s = ide.project.get('editor') || {};
		
		return (this.options = cxl.extend(
			{
				theme: 'twilight',
				tabSize: 4,
				indentWithTabs: true,
				lineWrapping: true,
				lineNumbers: true,
				electricChars: false,
				styleActiveLine: true,
				autoCloseTags: true,
				autoCloseBrackets: true,
				matchTags: true,
				matchBrackets: true,
				foldGutter: true,
				indentUnit: s.indentWithTabs ? 1 : (s.tabSize || 4), 
				lineSeparator: "\n",
				keyMap: 'default'
			}, s,
			{
				value: this.file.get('content') || '',
				mode: ft,
				scrollbarStyle: 'null',
				gutters: ['CodeMirror-lint-markers', "CodeMirror-linenumbers", 
				"CodeMirror-foldgutter"]	
			}
		));
	},
	
	/**
	 * Override keymap handle function to use codemirror plugin keymaps.
	 * TODO see if we can replace some plugins to avoid using this method.
	 */
	keymapHandle: function(key)
	{
	var
		maps = this.editor.state.keyMaps,
		l = maps.length,
		fn, result
	;
		while (l--)
		{
			if ((fn = maps[l][key]))
			{
				result = fn(this.editor);

				if (result !== codeMirror.Pass)
					return result;
			}
		}
		
		return false;
	},

	setup: function()
	{
	var
		options = this.get_options(),
		editor = this.editor = codeMirror(this.el, options)
	;
		this.file_content = options.value;
		
		//this.$el.on('keydown', this.on_keyup.bind(this));
		editor.on('focus', this.on_focus.bind(this));
		editor.on('blur', this.on_blur.bind(this));
		
		this.keymap = new ide.KeyMap();
		this.keymap.handle = this.keymapHandle.bind(this);
		this.listenTo(this.file, 'change:content', this.on_file_change);
	},

	resize: function()
	{
		setTimeout(this.editor.refresh.bind(this.editor), 200);
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
	
	somethingSelected: function()
	{
		return this.editor.somethingSelected();
	},

	getSelection: function()
	{
		return this.editor.getSelection(this.line_separator);
	},
	
	getLine: function(n)
	{
		n = n || this.editor.getCursor().line;
		
		return this.editor.getLine(n);
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
		// Save registers in localStorage for sync_registers.
		// TODO move to a better place.
		//this.plugin.data('registers', JSON.stringify(this.registers));
	},

	on_focus: function()
	{
		this.focus(true);
		//this.sync_registers();
	},
	
	on_file_change: function()
	{
		var content = this.file.get('content');
		
		if (!this.changed() && content!==this.file_content)
		{
		var
			editor = this.editor,
			cursor = editor.getCursor()
		;
			this.file_content = content;
			this.editor.operation(function() {
				editor.setValue(content);
				editor.setCursor(cursor);
			});
		}
	},

	focus: function(ignore)
	{
		ide.Editor.prototype.focus.apply(this);

		if (!ignore)
			this.editor.focus();
	},

	close: function(force)
	{
		if (!force && this.changed())
			return "File has changed. Are you sure?";

		ide.Editor.prototype.close.call(this);
	},

	write: function(filename)
	{
		if (filename)
			this.file.set('filename', filename);
		else if (this.file_content !== this.file.get('content'))
			return ide.error('File contents have changed.');
		
		if (!this.file.get('filename'))
			return ide.error('No file name.');

		this.file.set('content', (this.file_content=this.get_value()));
		this.file.save();
	},

	insert: function(text)
	{
		this.editor.replaceSelection(text);
	},

	changed: function()
	{
		return this.file_content !== this.get_value();
	},

	get_info: function()
	{
		return (this.changed() ? '+ ' : '') +
			(this.file.get('filename') || '[No Name]') +
			' [' + ide.project.get('name') + ']';
	},

	toggleFatCursor: function(state)
	{
		this.$el.toggleClass('cm-fat-cursor', state);
		this.editor.restartBlink();
	}

});

ide.plugins.register('editor', new ide.Plugin({

	edit: function(file, options)
	{
		if (!file.get('directory'))
		{
			if (!file.attributes.content)
				file.attributes.content = '';
			
		var
			editor = new ide.Editor.Source({
				slot: options.slot,
				plugin: this,
				file: file
			})
		;
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
