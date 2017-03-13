
(function(ide, cxl, codeMirror) {
"use strict";

codeMirror.defineOption('fatCursor', false, function(cm, val) {
	cm.display.wrapper.classList.toggle('cm-fat-cursor', val);
	cm.restartBlink();
});

/**
 * Use to provide Hints capabilities.
 */
class HintManager {
	
	//hints: null,
	
	constructor(editor) {
		this.__cm = editor.editor;
		this.hints = {};
	}

	clear(id)
	{
		cxl.invokeMap(this.hints[id], 'remove');
		this.hints[id] = [];
	}

	get(id)
	{
		return this.hints[id] || (this.hints[id]=[]);
	}
	
	filter(hints, line)
	{
		return hints.filter(function(h) {
			return h.line === line;
		});
	}

	getLine(id, line)
	{
		var hints = this.get(id);
		return this.filter(hints, line);
	}

	__createMark(line)
	{
		var el = document.createElement('DIV');

		this.__cm.setGutterMarker(line, 'editor-hint-gutter', el);

		return el;
	}

	__getMarker(line)
	{
		var h = this.__cm.lineInfo(line);

		return h && (h.gutterMarkers && h.gutterMarkers['editor-hint-gutter'] ||
			this.__createMark(line, h.handle));
	}

	__removeHint(el)
	{
		this.removeChild(el);
	}

	add(id, hint)
	{
	var
		el = document.createElement('DIV'),
		// Sometimes line will be 0...
		marker = this.__getMarker(hint.line>0 ? hint.line-1 : 0),
		hints = this.get(id)
	;
		// Invalid line?
		if (!marker)
			return;

		hint.line--;
		hint.el = el;
		hint.remove = this.__removeHint.bind(marker, el);

		hints.push(hint);

		el.setAttribute('class', 'editor-hint ' + (hint.className || 'info'));
		el.setAttribute('title', hint.title);
		el.innerHTML = '&nbsp;';

		marker.appendChild(el);
	}

}


/**
 * Events:
 *
 * tokenchange
 * cursorchange
 */
class SourceEditor extends ide.FileEditor {

	delSelection()
	{
		this.editor.replaceSelection('');
	}

	delLine()
	{
		this.editor.deleteLine();
	}

	replaceSelection(text)
	{
		var e = this.editor, c;

		if (!this.somethingSelected())
		{
			c = e.getCursor();
			e.setSelection({ line: c.line, ch: c.ch+1 }, c);
		}

		e.replaceSelection(text, 'start');
	}

	inputEnable()
	{
		if (this.editor.getOption('disableInput'))
		{
			this.editor.setOption('fatCursor', false);
			this.editor.setOption('disableInput', false);
		}
	}

	inputDisable()
	{
		if (this.editor.getOption('disableInput')===false)
		{
			// Go back one char if coming back from insert mode.
			if (this.editor.getCursor().ch>0)
				this.editor.execCommand('goCharLeft');

			this.editor.setOption('fatCursor', true);
			this.editor.setOption('disableInput', true);
		}
	}

	selectStart()
	{
		this.editor.display.shift = true;
	}

	selectEnd()
	{
		this.editor.display.shift = false;
	}

	insertTab()
	{
		this.editor.execCommand('defaultTab');
	}

	insertLine()
	{
		this.editor.execCommand('newlineAndIndent');
	}

	selectClear()
	{
		this.editor.setSelection(this.editor.getCursor('anchor'));
	}

	option(option, value)
	{
		if (value===undefined)
			return this.editor.getOption(option);
		else
			this.editor.setOption(option, value);
	}

	selectLine()
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
	}

	scroll(x, y)
	{
		this.editor.scrollTo(x, y<0 ? 0 : y);
	}

	scrollLineUp(n, dir)
	{
	var
		ed = this.editor,
		h = ed.defaultTextHeight(),
		scroll = ed.getScrollInfo(),
		y = (dir||-1) * Math.round(n ? h*n : scroll.clientHeight / 2)
	;
		this.scroll(scroll.left, scroll.top + y);
	}

	scrollLineDown(n)
	{
		this.scrollLineUp(n, 1);
	}

	scrollScreenDown(n)
	{
	var
		ed = this.editor,
		scroll = ed.getScrollInfo()
	;
		n = n || 1;
		this.scroll(scroll.left, scroll.top + scroll.height * n);
	}

	scrollScreenUp(n)
	{
		this.scrollScreenDown(-(n || 1));
	}

	go(line, ch)
	{
		this.editor.setCursor(line-1, ch);
	}

	search(n, options)
	{
		n = n || this.token && this.token.string;

		if (n)
			this.editor.find(n, options);
	}

	searchReplace(pattern, str, options)
	{
		this.editor.replace(pattern, str, options);
	}

	searchReplaceRange(pattern, str, from, to)
	{
		from = from || { line: 0, ch: 0 };
		to = to || { line: this.editor.lastLine() };
		this.editor.replace(pattern, str, {
			from: from, to: to, separator: this.options.lineSeparator
		});
	}

	insert(text)
	{
		this.editor.replaceSelection(text);
	}

	replaceRange(text, start, end)
	{
		this.editor.replaceRange(text, start, end);
	}

	cmd(fn, args)
	{
		if (!isNaN(fn))
			return this.go(fn);

		return super.cmd(fn, args);
	}

	getLastChange()
	{
	var
		history = this.editor.getHistory().done,
		l = history.length
	;
		while (l--)
			if (history[l].changes)
				return history[l];
	}

	getCursor()
	{
		return this.editor.getCursor();
	}

	getCursorCoordinates(cursor)
	{
		cursor = cursor || true;
		return this.editor.cursorCoords(cursor, 'window');
	}

	_findMode()
	{
	var
		filename = this.file.filename,
		mime = this.file.mime,
		info = (filename && codeMirror.findModeByFileName(filename)) ||
			(mime && codeMirror.findModeByMIME(mime)) ||
			codeMirror.findModeByMIME('text/plain'),
		mode = info.mode,
		promises,
		me = this
	;
		function getScript(mode)
		{
			return cxl.ajax({
				url: 'mode/' + mode + '/' + mode + '.js',
				cache: true, success: ide.source
			});
		}

		if (!codeMirror.modes[mode])
		{
			promises = [ getScript(mode) ];

			if (info.require)
				promises.push(getScript(info.require));

			Promise.all(promises).then(function() {
				me.editor.setOption('mode', info.mime || mode);
			}, function() {
				ide.error('Could not load mode.');
			});

			return;
		}

		return info.mime || mode;
	}

	_getOptions()
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
				value: this.file.content || '',
				theme: 'workspace',
				// Disable drag and drop so dragdrop plugin works.
				dragDrop: false,
				mode: ft,
				scrollbarStyle: 'null',
				gutters: [ "CodeMirror-linenumbers",
				"CodeMirror-foldgutter",'editor-hint-gutter']
			}
		));
	}

	/**
	 * Override keymap handle function to use codemirror plugin keymaps.
	 * TODO see if we can replace some plugins to avoid using this method.
	 */
	_keymapHandle(key)
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
	}

	onCursorActivity()
	{
		var token = this.getToken();

		if (this.token !== token)
		{
			this.token = token;
			ide.plugins.trigger('token', this, token);
		}
	}

	onChange()
	{
		this.value = this.editor.getValue();
		this.file.content = this.value;
		ide.plugins.trigger('editor.change', this);
	}

	onScroll()
	{
		ide.plugins.trigger('editor.scroll', this);
	}

	render()
	{
		super.render();
	var
		options = this._getOptions(),
		editor = this.editor = codeMirror(this.$content, options)
	;
		this.hints = new HintManager(this);

		this.keymap.handle = this._keymapHandle.bind(this);

		this.listenTo(editor, 'focus', this._on_focus);
		this.listenTo(editor, 'cursorActivity', this.onCursorActivity);
		this.listenTo(editor, 'change', cxl.debounce(this.onChange.bind(this), 100));
		this.listenTo(ide.plugins, 'workspace.resize', this.resize);
		this.listenTo(editor, 'scroll', this.onScroll);
	}

	resize()
	{
		setTimeout(this.editor.refresh.bind(this.editor), 200);
	}

	/**
	 * Gets token at pos. If pos is ommited it will return the token
	 * under the cursor
	 */
	getToken(pos)
	{
		pos = pos || this.editor.getCursor();
		var token = this.editor.getTokenAt(pos, true);
		token.line = pos.line;
		token.ch = pos.ch;
		return token;
	}

	getChar(pos)
	{
		var cursor = this.editor.getCursor();
		pos = pos || cursor;
		var result = this.editor.getRange(pos,
			{ line: pos.line, ch: pos.ch+1 });

		this.editor.setCursor(cursor);

		return result;
	}

	/**
	 * Gets cursor element.
	 */
	/*get_cursor: function()
	{
		return this.editor.renderer.$cursorLayer.cursor;
	},*/

	somethingSelected()
	{
		return this.editor.somethingSelected();
	}

	getSelection()
	{
		return this.editor.getSelection(this.options.lineSeparator);
	}
	
	getLine(n)
	{
		n = n || this.editor.getCursor().line;

		return this.editor.getLine(n);
	}

	_on_focus()
	{
		this.focus(true);
	}

	setValue(content)
	{
		if (content === this.value)
			return;

		// TODO figure out a way not to scroll
		var cursor = this.editor.getCursor();

		this.editor.setValue(content, false);
		this.editor.setCursor(cursor, null, { scroll: false });
	}

	focus(ignore)
	{
		ide.Editor.prototype.focus.apply(this);
		this.onCursorActivity();

		if (!ignore)
			this.editor.focus();
	}

}

/*cxl.each(codeMirror.commands, function(cmd, key) {

	var fn = SourceEditor.prototype.commands[key];

	if (!fn)
		SourceEditor.prototype.commands[key] = function() {
			cmd.call(codeMirror, this.editor);
		};

});*/

ide.SourceEditor = SourceEditor;
ide.defaultEdit = function(options)
{
	var file = options.file;

	if (!file.attributes.content)
		file.attributes.content = '';

	var editor = new ide.SourceEditor({
		file: options.file,
		slot: options.slot
	});

	if (options && options.line)
		setTimeout(function() {
			editor.go(options.line);
		});

	return editor;
};

})(this.ide, this.cxl, this.CodeMirror);
