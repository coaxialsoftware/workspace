
(function(ide, cxl, _, codeMirror, $) {
"use strict";
	
/**
 * Use to provide Hints capabilities.
 */
function HintManager(editor) {
	this.__cm = editor.editor;
	this.hints = {};
}

_.extend(HintManager.prototype, {
	
	hints: null,
	
	clear: function(id)
	{
		_.invoke(this.hints[id], 'remove');
		this.hints = [];
	},
	
	get: function(id)
	{
		return this.hints[id] || (this.hints[id]=[]);
	},
	
	getLine: function(id, line)
	{
		var hints = this.get(id);
		return _.filter(hints, 'line', line);
	},
	
	__createMark: function(line, lineHandle)
	{
		var el = document.createElement('DIV');
			
		el.style.height=(lineHandle.height|0) + 'px';
		this.__cm.setGutterMarker(line, 'editor-hint-gutter', el);	
		
		return el;
	},
	
	__getMarker: function(line)
	{
		var h = this.__cm.lineInfo(line);
	
		return h.gutterMarkers && h.gutterMarkers['editor-hint-gutter'] ||
			this.__createMark(line, h.handle);
	},
	
	__removeHint: function(el)
	{
		this.removeChild(el);	
	},
	
	add: function(id, hint)
	{
	var
		el = document.createElement('DIV'),
		marker = this.__getMarker(hint.line-1),
		hints = this.get(id)
	;
		hint.line--;
		hint.el = el;
		hint.remove = this.__removeHint.bind(marker, el);
		
		hints.push(hint);
		
		el.setAttribute('class', 'editor-hint ' + (hint.type || 'info'));
		el.setAttribute('title', hint.hint);
		
		marker.appendChild(el);
	}
	
});

	
/**
 * Events:
 *
 * tokenchange
 * cursorchange
 */
ide.Editor.Source = ide.Editor.extend({

	editor: null,
	mode: null,
	hints: null,

	// Stores previous token. Used by tokenchange event.
	_old_token: null,

	deleteSelection: function()
	{
		this.editor.replaceSelection('');	
	},

	replaceSelection: function(text)
	{
		var e = this.editor, c;
		
		if (!this.somethingSelected())
		{
			c = e.getCursor();
			e.setSelection({ line: c.line, ch: c.ch+1 }, c);
		}
		
		e.replaceSelection(text, 'start');
	},
		
	enableInput: function()
	{	
		if (this.editor.getOption('disableInput'))
		{
			this.toggleFatCursor(false);
			this.editor.setOption('disableInput', false);
		}
	},

	disableInput: function()
	{
		if (this.editor.getOption('disableInput')===false)
		{
			// Go back one char if coming back from insert mode.
			if (this.editor.getCursor().ch>0)
				this.editor.execCommand('goCharLeft');

			this.toggleFatCursor(true);
			this.editor.setOption('disableInput', true);
			
		}
	},
	
	startSelect: function()
	{
		this.editor.display.shift = true;
	},
	
	endSelect: function()
	{
		this.editor.display.shift = false;
	},

	newline: function()
	{
		this.editor.execCommand('newlineAndIndent');	
	},

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
		e.setSelection(
			{ line: anchor.line, ch: anchorEnd },
			{ line: head.line, ch: headEnd },
			{ extending: true }
		);
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
	
	getLastChange: function()
	{
	var
		history = this.editor.getHistory().done,
		l = history.length
	;
		while (l--)
			if (history[l].changes)
				return history[l];
	},

	getValue: function()
	{
		return this.editor.getValue(this.options.lineSeparator);
	},

	getPosition: function()
	{
		return this.editor.getCursor();
	},
	
	_findMode: function()
	{
	var
		filename = this.file.get('filename'),
		info = filename && (codeMirror.findModeByFileName(filename) ||
			codeMirror.findModeByMIME(this.file.get('mime'))) ||
			codeMirror.findModeByMIME('text/plain'),
		mode = info.mode,
		promises,
		me = this
	;
		function getScript(mode)
		{
			return $.ajax({
				url: 'mode/' + mode + '/' + mode + '.js',
				cache: true, success: ide.source
			});
		}

		if (!codeMirror.modes[mode])
		{
			promises = [ getScript(mode) ];
			
			if (info.require)
				promises.push(getScript(info.require));
			
			$.when.apply($, promises).then(function() {
				me.editor.setOption('mode', info.mime || mode);
			}, function() {
				ide.error('Could not load mode.');
			});
			
			return;
		}
		
		return info.mime || mode;
	},
	
	_getOptions: function()
	{
	var
		ft = this.mode = this._findMode(),
		s = ide.project.get('editor') || {}
	;
		return (this.options = cxl.extend(
			{
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
				theme: 'workspace',
				// Disable drag and drop so dragdrop plugin works.
				dragDrop: false,
				mode: ft,
				scrollbarStyle: 'null',
				gutters: [ "CodeMirror-linenumbers", 
				"CodeMirror-foldgutter",'editor-hint-gutter']	
			}
		));
	},
	
	/**
	 * Override keymap handle function to use codemirror plugin keymaps.
	 * TODO see if we can replace some plugins to avoid using this method.
	 */
	_keymapHandle: function(key)
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
	
	onCursorActivity: function()
	{
		var token = this._getToken();
		
		if (this.token !== token)
		{
			this.token = token;
			ide.plugins.trigger('token', this, token);
		}
	},

	_setup: function()
	{
	var
		options = this._getOptions(),
		editor = this.editor = codeMirror(this.el, options)
	;
		this.file_content = options.value;
		
		this.features({
			keymap: new ide.KeyMap(),
			hints: new HintManager(this)
		});
		this.keymap.handle = this._keymapHandle.bind(this);
		
		this.listenTo(this.file, 'change:content', this._on_file_change);
		this.listenTo(editor, 'focus', this._on_focus);
		this.listenTo(editor, 'cursorActivity', this.onCursorActivity);
		this.listenTo(ide.plugins, 'workspace.resize', this.resize);
	},

	resize: function()
	{
		setTimeout(this.editor.refresh.bind(this.editor), 200);
	},
	
	search: function(n, options)
	{
		if (n)
			this.editor.find(n, options);
	},
	
	replace: function(pattern, str, options)
	{
		this.editor.replace(pattern, str, options);
	},

	replaceRange: function(pattern, str, from, to)
	{
		from = from || { line: 0, ch: 0 };
		to = to || { line: this.editor.lastLine() };
		this.editor.replace(pattern, str, {
			from: from, to: to, separator: this.line_separator
		});
	},

	/**
	 * Gets token at pos. If pos is ommited it will return the token
	 * under the cursor
	 */
	_getToken: function(pos)
	{
		pos = pos || this.editor.getCursor();
		var token = this.editor.getTokenAt(pos, true);
		token.line = pos.line;
		token.ch = pos.ch;
		return token;
	},

	getChar: function(pos)
	{
		var cursor = this.editor.getCursor();
		pos = pos || cursor;
		var result = this.editor.getRange(pos, 
			{ line: pos.line, ch: pos.ch+1 });
		
		this.editor.setCursor(cursor);
		
		return result;
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

	_on_focus: function()
	{
		this.focus(true);
		//this.sync_registers();
	},
	
	_on_file_change: function()
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

	write: function(filename)
	{
		if (filename)
			this.file.set('filename', filename);
		else if (this.file_content !== this.file.get('content'))
			return ide.error('File contents have changed.');
		
		if (!this.file.get('filename'))
			return ide.error('No file name.');

		this.file.set('content', (this.file_content=this.getValue()));
		this.file.save();
		
		ide.plugins.trigger('editor.write', this);
	},

	insert: function(text)
	{
		this.editor.replaceSelection(text);
	},

	changed: function()
	{
		return this.file_content !== this.getValue();
	},

	getInfo: function()
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
	
ide.defaultEdit = function(options)
{
	var file = options.file;
	
	if (!file.get('directory'))
	{
		if (!file.attributes.content)
			file.attributes.content = '';

		var editor = new ide.Editor.Source(options);

		if (options && options.line)
			setTimeout(function() {
				editor.go(options.line);
			});

		return editor;
	}
};

})(this.ide, this.cxl, this._, this.CodeMirror, this.jQuery);
