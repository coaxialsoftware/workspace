
(function(ide, cxl, codeMirror) {
"use strict";

codeMirror.defineOption('fatCursor', false, function(cm, val) {
	cm.display.wrapper.classList.toggle('cm-fat-cursor', val);
	cm.restartBlink();
});

/**
 * Use to provide Hints capabilities.
 */
class SourceHintsFeature extends ide.feature.HintsFeature {

	constructor(e)
	{
		super(e);
		this.hints = {};
	}
	
	render()
	{
		this.__cm = this.editor.editor;
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

class SourceInsertFeature extends ide.feature.InsertFeature {

	tab()
	{
		this.editor.editor.execCommand('defaultTab');
	}

	backspace()
	{
		codeMirror.commands.delCharBefore(this.editor.editor);
	}

	del()
	{
		codeMirror.commands.delCharAfter(this.editor.editor);
	}

	line()
	{
		codeMirror.commands.newlineAndIndent(this.editor.editor);
	}

	enable()
	{
		var cm = this.editor.editor;

			cm.setOption('fatCursor', false);
			cm.setOption('disableInput', false);
			this.enabled = true;
			// Need to make sure editor is focused for keyboard events
			cm.focus();
	}

	disable()
	{
		var cm = this.editor.editor;

		if (cm.getOption('disableInput')===false)
		{
			// Go back one char if coming back from insert mode.
			if (cm.getCursor().ch>0)
				cm.execCommand('goCharLeft');

			cm.setOption('fatCursor', true);
			cm.setOption('disableInput', true);
			this.enabled = false;
		}
	}

}

class SourceCursorFeature extends ide.feature.CursorFeature {

	get row()
	{
	}

	get column()
	{
	}

	goDown()
	{
		codeMirror.commands.goLineDown(this.editor.editor);
	}
	
	goUp()
	{
		codeMirror.commands.goLineUp(this.editor.editor);
	}

	goBackwards()
	{
		codeMirror.commands.goCharLeft(this.editor.editor);
	}

	goForward()
	{
		codeMirror.commands.goCharRight(this.editor.editor);
	}

	goStart()
	{
		codeMirror.commands.goDocStart(this.editor.editor);
	}

	goEnd()
	{
		codeMirror.commands.goDocEnd(this.editor.editor);
	}

	go(row, column)
	{
		this.editor.editor.setCursor(row, column);
	}

	enter()
	{
		this.goDown();
	}

	valueAt(row, column)
	{
		var cursor = this.editor.getCursor();

		if (row===undefined) row = cursor.line;
		if (column===undefined) column = cursor.ch;

		var result = this.editor.getRange(
			{ line: row, ch: column }, { line: row, ch: column+1 });

		this.editor.setCursor(cursor);

		return result;
	}

	get current()
	{
		return this.valueAt();
	}
	
}

class SourceFocusFeature extends ide.feature.FocusFeature {
	
	render()
	{
		this.editor.listenTo(this.editor.editor, 'focus', this.set.bind(this));
	}
	
	set()
	{
		super.set();
		
		if (!this.editor.editor.hasFocus())
			this.editor.editor.focus();
	}

}

class SourceScrollFeature extends ide.feature.ScrollFeature {

	render()
	{
		this.editor.listenTo(this.editor.editor, 'scroll', this._onScroll);
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

	_onScroll()
	{
		ide.plugins.trigger('editor.scroll', this);
	}

}

class SourceSelectionFeature extends ide.feature.SelectionFeature {

	begin()
	{
		this.editor.editor.display.shift = true;
	}

	end()
	{
		this.editor.editor.display.shift = false;
	}

	clear()
	{
		this.editor.editor.setSelection(this.editor.editor.getCursor('anchor'));
	}

	remove()
	{
		this.editor.editor.replaceSelection('');
	}

	replace(str)
	{
		this.editor.editor.replaceSelection(str);	
	}

	get current()
	{
	}

	get value()
	{
		return this.editor.editor.getSelection(this.editor.options.lineSeparator);
	}

	somethingSelected()
	{
		return this.editor.editor.somethingSelected();
	}

}

SourceSelectionFeature.commands = Object.assign({
	'selection.showCursor': function() {
		this.editor.setOption('showCursorWhenSelecting', true);
	},
	'selection.hideCursor': function() {
		this.editor.setOption('showCursorWhenSelecting', false);
	}
}, ide.feature.SelectionFeature.commands);

class SourceHistoryFeature extends ide.feature.HistoryFeature {

	getLastChange()
	{
	var
		history = this.editor.editor.getHistory().done,
		l = history.length
	;
		while (l--)
			if (history[l].changes)
				return history[l];
	}

	undo()
	{
		this.editor.editor.undo();
	}

	redo()
	{
		this.editor.editor.redo();
	}

}

class SourceLineFeature extends ide.feature.LineFeature {

	get columnStart()
	{
		return 0;
	}

	get columnEnd()
	{
	var
		cm = this.editor.editor,
		cursor = cm.getCursor('head')
	;
		// TODO ?
		return this.editor.editor.getLine(cursor.line).length;
	}

	get rowStart()
	{
		return this.editor.editor.getCursor('head').line;
	}
	
	get rowEnd()
	{
		return this.editor.editor.getCursor('head').line;
	}

	get current()
	{
	}

	get value()
	{
		return this.editor.editor.getLine(this.editor.editor.getCursor().line);
	}

	getValue(n)
	{
		n = n || this.editor.getCursor().line;

		return this.editor.getLine(n);
	}

	remove()
	{
		codeMirror.commands.deleteLine(this.editor.editor);
	}

	select()
	{
	var
		e = this.editor.editor,
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

}

class SourceWordFeature extends ide.feature.WordFeature {

	get current()
	{
	var
		editor = this.editor,
		row = editor.cursor.row,
		col = editor.cursor.column
	;
		if (row===this.$row && col===this.$col)
			return this.$current;

		this.$row = row;
		this.$col = col;
	}

}

SourceWordFeature.commands = Object.assign({}, ide.feature.WordFeature.commands, {

	'word.goNext': function() { codeMirror.commands.goGroupRight(this.editor); },
	'word.goPrevious': function() { codeMirror.commands.goGroupLeft(this.editor); }

});

class SourcePageFeature extends ide.feature.PageFeature {

	
}

class SourceSearchFeature extends ide.feature.SearchFeature {

	search(n, reverse)
	{
		n = n || this.token && this.token.string;

		if (n)
			this.editor.editor.find(n, reverse && { reverse: true } );
	}

}

class SourceTokenFeature extends ide.feature.TokenFeature {

	render()
	{
		this.editor.listenTo(this.editor.editor, 'cursorActivity',
			this._onCursorActivity.bind(this));
	}

	get current()
	{
		return this.token;
	}

	/**
	 * Gets token at pos. If pos is ommited it will return the token
	 * under the cursor
	 */
	getToken(pos)
	{
	var
		cm = this.editor.editor,
		token, result = this.token = new ide.Token()
	;
		pos = pos || cm.getCursor();
		token = cm.getTokenAt(pos, true);

		result.row = pos.line;
		result.column = pos.ch;

		return result;
	}

	_onCursorActivity()
	{
		var token = this.getToken();

		if (this.token !== token)
		{
			this.token = token;
			ide.plugins.trigger('token', this, token);
		}
	}

}
	
class SourceIndentFeature extends ide.feature.IndentFeature {
	
	more()
	{
		codeMirror.commands.indentMore(this.editor.editor);	
	}
	
	less()
	{
		codeMirror.commands.indentLess(this.editor.editor);	
	}
	
	auto()
	{
		codeMirror.commands.indentAuto(this.editor.editor);	
	}
	
}

/**
 * Events:
 *
 * tokenchange
 * cursorchange
 */
class SourceEditor extends ide.FileEditor {

	/*
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
	*/

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

	replaceRange(text, start, end)
	{
		this.editor.replaceRange(text, start, end);
	}

	cmd(fn, args)
	{
		if (!isNaN(fn))
			return this.cursor.go(fn-1);

		return super.cmd(fn, args);
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
				cache: true
			}).then(ide.source);
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

	render(p)
	{
		super.render(p);
	var
		options = this._getOptions(),
		editor = this.editor = codeMirror(this.$content, options)
	;
		this.keymap.handle = this._keymapHandle.bind(this);

		this.listenTo(editor, 'change', cxl.debounce(this.onChange.bind(this), 100));
		this.listenTo(ide.plugins, 'workspace.resize', this.resize);
	}

	onChange()
	{
		this.value = this.editor.getValue();
		this.file.content = this.value;
		this.header.changed = this.file.hasChanged();
		ide.plugins.trigger('editor.change', this);
	}

	resize()
	{
		setTimeout(this.editor.refresh.bind(this.editor), 200);
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

}

SourceEditor.features(
	SourceFocusFeature, SourceHintsFeature, ide.feature.FileFeature,
	SourceInsertFeature, SourceCursorFeature, SourceScrollFeature, SourceSelectionFeature,
	SourceLineFeature, SourceHistoryFeature, SourceWordFeature, SourcePageFeature,
	SourceTokenFeature, SourceSearchFeature, SourceIndentFeature
);

ide.SourceEditor = SourceEditor;
ide.defaultEdit = function(options)
{
	var file = options.file || new ide.File();

	if (!file.attributes.content)
		file.attributes.content = '';

	var editor = new ide.SourceEditor({
		file: file,
		slot: options.slot
	});

	if (options && options.line)
		setTimeout(function() {
			editor.go(options.line);
		});

	return editor;
};

})(this.ide, this.cxl, this.CodeMirror);
