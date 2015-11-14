
(function(ide, cxl, _, codeMirror, $) {
"use strict";
	
codeMirror.defineOption('fatCursor', false, function(cm, val) {
	cm.display.wrapper.classList.toggle('cm-fat-cursor', val);
	cm.restartBlink();
});
	
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
		// Sometimes line will be 0...
		marker = this.__getMarker(hint.line>0 ? hint.line-1 : 0),
		hints = this.get(id)
	;
		hint.line--;
		hint.el = el;
		hint.remove = this.__removeHint.bind(marker, el);
		
		hints.push(hint);
		
		el.setAttribute('class', 'editor-hint ' + (hint.className || 'info'));
		el.setAttribute('title', hint.title);
		
		marker.appendChild(el);
	}
	
});

	
/**
 * Events:
 *
 * tokenchange
 * cursorchange
 */
ide.Editor.Source = ide.Editor.File.extend({

	editor: null,
	mode: null,
	hints: null,

	commands: {
	
		delSelection: function()
		{
			this.editor.replaceSelection('');	
		},
		
		delLine: 'deleteLine',

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

		inputEnable: function()
		{	
			if (this.editor.getOption('disableInput'))
			{
				this.editor.setOption('fatCursor', false);
				this.editor.setOption('disableInput', false);
			}
		},

		inputDisable: function()
		{
			if (this.editor.getOption('disableInput')===false)
			{
				// Go back one char if coming back from insert mode.
				if (this.editor.getCursor().ch>0)
					this.editor.execCommand('goCharLeft');

				this.editor.setOption('fatCursor', true);
				this.editor.setOption('disableInput', true);
			}
		},
	
		selectStart: function()
		{
			this.editor.display.shift = true;
		},

		selectEnd: function()
		{
			this.editor.display.shift = false;
		},
		
		insertTab: function()
		{
			this.editor.execCommand('defaultTab');	
		},

		insertLine: function()
		{
			this.editor.execCommand('newlineAndIndent');	
		},

		selectClear: function()
		{
			this.editor.setSelection(this.editor.getCursor('anchor'));
		},
		
		option: function(option, value)
		{
			if (value===undefined)
				return this.editor.getOption(option);
			else
				this.editor.setOption(option, value);
		},

		selectLine: function()
		{
		var
			e = this.editor,
			anchor = e.getCursor('anchor'),
			head = e.getCursor('head'),
			// True is "down"
			bias = (head.line === anchor.line) ?
				(head.ch < anchor.ch) :
				(head.line > anchor.line),
			anchorEnd = bias ? 0 : e.getLine(anchor.line).length,
			headEnd = bias ? e.getLine(head.line).length : 0	
		;
			e.setSelection(
				{ line: anchor.line, ch: anchorEnd },
				{ line: head.line, ch: headEnd },
				{ extend: true, origin: 'select' }
			);
		},
		
		go: function(n)
		{
			this.editor.setCursor(n-1);
		},
		
		search: function(n, options)
		{
			n = n || this.token && this.token.string;
			
			if (n)
				this.editor.find(n, options);
		},

		searchReplace: function(pattern, str, options)
		{
			this.editor.replace(pattern, str, options);
		},

		searchReplaceRange: function(pattern, str, from, to)
		{
			from = from || { line: 0, ch: 0 };
			to = to || { line: this.editor.lastLine() };
			this.editor.replace(pattern, str, {
				from: from, to: to, separator: this.options.lineSeparator
			});
		},

		insert: function(text)
		{
			this.editor.replaceSelection(text);
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

	getCursor: function()
	{
		return this.editor.getCursor();
	},
	
	getCursorCoordinates: function(cursor)
	{
		cursor = cursor || true;
		return this.editor.cursorCoords(cursor, 'window');	
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
				lineSeparator: "\n"
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
		var token = this.getToken();
		
		if (this.token !== token)
		{
			this.token = token;
			ide.plugins.trigger('token', this, token);
		}
	},
	
	onChange: function()
	{
		this.value = this.editor.getValue();
		this.file.set('content', this.value);
		ide.plugins.trigger('editor.change', this);	
	},
	
	onScroll: function()
	{
		ide.plugins.trigger('editor.scroll', this);
	},

	_setup: function()
	{
	var
		options = this._getOptions(),
		editor = this.editor = codeMirror(this.el, options)
	;
		this.keymap = new ide.KeyMap();
		this.hints = new HintManager(this);

		this.keymap.handle = this._keymapHandle.bind(this);
		
		this.listenTo(editor, 'focus', this._on_focus);
		this.listenTo(editor, 'cursorActivity', this.onCursorActivity);
		this.listenTo(editor, 'change', _.debounce(this.onChange.bind(this), 100));
		this.listenTo(ide.plugins, 'workspace.resize', this.resize);
		this.listenTo(editor, 'scroll', this.onScroll);
	},

	resize: function()
	{
		setTimeout(this.editor.refresh.bind(this.editor), 200);
	},

	/**
	 * Gets token at pos. If pos is ommited it will return the token
	 * under the cursor
	 */
	getToken: function(pos)
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
		return this.editor.getSelection(this.options.lineSeparator);
	},
	
	getLine: function(n)
	{
		n = n || this.editor.getCursor().line;
		
		return this.editor.getLine(n);
	},

	_on_focus: function()
	{
		this.focus(true);
	},

	setValue: function(content)
	{
	var
		editor = this.editor,
		cursor = editor.getCursor()
	;
		editor.operation(function() {
			editor.setValue(content);
			editor.setCursor(cursor);
		});
	},
	
	focus: function(ignore)
	{
		ide.Editor.prototype.focus.apply(this);

		if (!ignore)
			this.editor.focus();
	}

});
	
ide.defaultEdit = function(options)
{
	var file = options.file;
	
	if (!file.attributes.content)
		file.attributes.content = '';

	var editor = new ide.Editor.Source(options);

	if (options && options.line)
		setTimeout(function() {
			editor.go(options.line);
		});

	return editor;
};

})(this.ide, this.cxl, this._, this.CodeMirror, this.jQuery);
