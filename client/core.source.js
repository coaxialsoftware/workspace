((ide, cxl, codeMirror) => {
"use strict";

const
	COMMANDS = codeMirror.commands
;

codeMirror.defineOption('fatCursor', false, function(cm, val) {
	cm.display.wrapper.classList.toggle('cm-fat-cursor', val);
});

class CodeMirrorOptions {

	constructor(mode)
	{
		const s = ide.project.get('editor') || {};

		Object.assign(this,
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
				//value: this.file.content || '',
				theme: 'workspace',
				// Disable drag and drop so dragdrop plugin works.
				dragDrop: false,
				mode: mode,
				scrollbarStyle: 'null',
				gutters: [ "CodeMirror-linenumbers",
				"CodeMirror-foldgutter",'editor-hint-gutter']
			}
		);
	}

	addEventListener(el, type, cb)
	{
		this.$cm.on(el, type, cb);
	}

	removeEventListener(el, type, cb)
	{
		this.$cm.off(el, type, cb);
	}

}

/**
 * Use to provide Hints capabilities.
 */
class SourceHintsFeature extends ide.feature.HintsFeature {

	render()
	{
		super.render();
		this.__cm = this.editor.editor;
	}

	__createMark(line)
	{
		var el = document.createElement('DIV');

		this.__cm.setGutterMarker(line, 'editor-hint-gutter', el);
		el.className = 'editor-hint-gutter';

		return el;
	}

	__getMarker(line)
	{
		var h = this.__cm.lineInfo(line);

		return h && (h.gutterMarkers && h.gutterMarkers['editor-hint-gutter'] ||
			this.__createMark(line, h.handle));
	}

	remove(hint)
	{
		// TODO use custom hint class
		cxl.pull(this.hints, hint);
		hint.$hintEl.parentNode.removeChild(hint.$hintEl);
	}

	add(hint)
	{
	var
		el = document.createElement('DIV'),
		line = hint.range.row,
		marker = this.__getMarker(line)
	;
		// Invalid line?
		if (!marker)
			return;

		hint = super.add(hint);
		hint.$hintEl = el;

		el.setAttribute('class', 'editor-hint bg-' + (hint.className || 'info'));
		el.setAttribute('title', hint.title);
		el.innerHTML = '&nbsp;';

		marker.appendChild(el);
	}

}

class SourceInsertFeature extends ide.feature.InsertFeature {

	constructor(p)
	{
		super(p);
		this.enabled = true;
	}

	tab()
	{
		this.editor.editor.execCommand('defaultTab');
	}

	backspace()
	{
		COMMANDS.delCharBefore(this.editor.editor);
	}

	del()
	{
		COMMANDS.delCharAfter(this.editor.editor);
	}

	line()
	{
		COMMANDS.newlineAndIndent(this.editor.editor);
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
		return this.editor.editor.getCursor().line;
	}

	set row(row)
	{
		this.editor.editor.setCursor(row);
	}

	get column()
	{
		return this.editor.editor.getCursor().ch;
	}

	set column(col)
	{
		this.editor.editor.setCursor(null, col);
	}

	goDown()
	{
		COMMANDS.goLineDown(this.editor.editor);
	}

	goUp()
	{
		COMMANDS.goLineUp(this.editor.editor);
	}

	goBackwards()
	{
		COMMANDS.goColumnLeft(this.editor.editor);
	}

	goForward()
	{
		COMMANDS.goColumnRight(this.editor.editor);
	}

	goStart()
	{
		COMMANDS.goDocStart(this.editor.editor);
	}

	goEnd()
	{
		COMMANDS.goDocEnd(this.editor.editor);
	}

	go(row, column)
	{
		var first = this.editor.editor.options.firstLineNumber||0;
		this.editor.editor.setCursor(row-first, column);
	}

	valueAt(row, column)
	{
	var
		cm = this.editor.editor,
		cursor = cm.getCursor()
	;

		if (row===undefined) row = cursor.line;
		if (column===undefined) column = cursor.ch;

		var result = cm.getRange(
			{ line: row, ch: column }, { line: row, ch: column+1 });

		cm.setCursor(cursor);

		return result;
	}

	get value()
	{
		return this.valueAt();
	}

	enter()
	{
		if (this.editor.insert.enabled)
			this.editor.insert.line();
		else
			this.goDown();
	}

}

class SourceScrollFeature extends ide.feature.ScrollFeature {

	render()
	{
		this.editor.listenToCM('scroll', this._onScroll);
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
		this.editor.editor.replaceSelection('', 'start');
	}

	replace(str)
	{
		this.editor.editor.replaceSelection(str);
	}

	selectAll()
	{
		COMMANDS.selectAll(this.editor.editor);
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

	get lastInsert()
	{
	var
		cm = this.editor.editor,
		history = cm.getHistory().done,
		l = history.length
	;
		while (l--)
			if (history[l].changes)
				return cm.getRange(history[l].changes[0].from, history[l].changes[0].to);
	}

	getAll()
	{
		var done = this.editor.editor.getHistory().done;

		return done && done.map(function(h) {
			return new ide.HistoryRecord(h.changes ? 'edit' : 'selection');
		});
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
		COMMANDS.deleteLine(this.editor.editor);
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

	goStart()
	{
		COMMANDS.goLineStart(this.editor.editor);
	}

	goEnd()
	{
		COMMANDS.goLineEnd(this.editor.editor);
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

	goNext()
	{
		COMMANDS.goGroupRight(this.editor.editor);
	}

	goPrevious()
	{
		COMMANDS.goGroupLeft(this.editor.editor);
	}

	removeNext()
	{
		COMMANDS.delGroupAfter(this.editor.editor);
	}

	removePrevious()
	{
		COMMANDS.delGroupBefore(this.editor.editor);
	}

}

class SourcePageFeature extends ide.feature.PageFeature {

	// TODO add current

	goUp()
	{
		COMMANDS.goPageUp(this.editor.editor);
	}

	goDown()
	{
		COMMANDS.goPageDown(this.editor.editor);
	}

}

class SourceIndentFeature extends ide.feature.IndentFeature {

	more()
	{
		COMMANDS.indentMore(this.editor.editor);
	}

	less()
	{
		COMMANDS.indentLess(this.editor.editor);
	}

	auto()
	{
		COMMANDS.indentAuto(this.editor.editor);
	}

}

class SourceFoldFeature extends ide.feature.FoldFeature {

	isFolded(row, column)
	{
	var
		cm = this.editor.editor,
		pos = cm.getCursor()
	;
		return this.editor.editor.isFolded({
			line: row || pos.line, ch: column || pos.ch
		});
	}

	toggle()
	{
		COMMANDS.toggleFold(this.editor.editor);
	}

	open()
	{
		COMMANDS.unfold(this.editor.editor);
	}

	close()
	{
		COMMANDS.fold(this.editor.editor);
	}

}

class SourceRange extends ide.Token {

	constructor(editor, startRow, startColumn, endRow, endColumn)
	{
		super();
		this.editor = editor;
		this.row = startRow;
		this.column = startColumn;
		this.endRow = endRow;
		this.endColumn = endColumn;
	}

	get value()
	{
		return this.editor.editor.getRange(
			{ line: this.row, ch: this.column },
			{ line: this.endRow, ch: this.endColumn }
		);
	}

	replace(text)
	{
		// TODO optimize
		var cursor = this.editor.editor.getCursor();
		this.editor.editor.replaceRange(text,
			{ line: this.row, ch: this.column },
			{ line: this.endRow, ch: this.endColumn },
			'range.replace'
		);
		this.editor.editor.setCursor(cursor);
	}

	getCoordinates()
	{
		return this.editor.editor.charCoords({ line: this.row, ch: this.column });
	}

}

class SourceRangeFeature extends ide.feature.RangeFeature {

	create(startRow, startColumn, endRow, endColumn)
	{
		return new SourceRange(this.editor, startRow, startColumn, endRow, endColumn);
	}

}

class SourceSearchFeature extends ide.feature.SearchFeature {

	search(n, reverse)
	{
		var match;

		n = n || this.lastSearch;

		if (n)
		{
			match = this.editor.editor.find(n, reverse && { backwards: true } );
			this.lastSearch = n;
			return match.found && new SourceRange(this.editor, match.from.line, match.from.ch,
				match.to.line, match.to.ch);
		}
	}

	// TODO
	searchReplaceRange(pattern, str, from, to)
	{
		from = from || { line: 0, ch: 0 };
		to = to || { line: this.editor.lastLine() };
		this.editor.replace(pattern, str, {
			from: from, to: to, separator: this.options.lineSeparator
		});
	}

}

class SourceToken extends SourceRange {

	replace(text)
	{
		this.editor.editor.replaceRange(text,
			{ line: this.row, ch: this.column },
			{ line: this.endRow, ch: this.endColumn },
			'range.replace'
		);
	}

}

Object.defineProperty(SourceToken.prototype, 'value',
	{ writable: true, enumerable: true, value: null });

class SourceTokenFeature extends ide.feature.TokenFeature {

	constructor(editor)
	{
		super(editor);
		this.current = new SourceToken(this.editor);
		editor.$assistData.token = {};
	}

	render()
	{
		this.editor.listenToCM('cursorActivity',
			this._onCursorActivity.bind(this));
	}

	/**
	 * Gets token at pos. If pos is ommited it will return the token
	 * under the cursor
	 */
	getToken(row, column, result)
	{
	var
		cm = this.editor.editor,
		token
	;
		// TODO replace getTokenAt
		token = cm.getTokenAt({ line: row, ch: column }, true);

		result = result || new SourceToken(this.editor);

		// Token Value is constant
		result.row = result.endRow = row;
		result.column = token.start;
		result.endColumn = token.end;
		result.value = token.string;
		result.type = token.type;
		result.cursorRow = row;
		result.cursorColumn = column;
		result.cursorValue = token.string.substr(0, result.cursorColumn-token.start);
		result.$token = token;

		return result;
	}

	assist(t)
	{
		var c = this.current;

		t.row = c.row;
		t.column = c.column;
		t.cursorColumn = c.cursorColumn;
		t.cursorRow = c.cursorRow;
		t.type = c.type;
		t.value = c.value;
		t.cursorValue = c.cursorValue;
	}

	_onCursorActivity()
	{
		var pos = this.editor.editor.getCursor();
		this.getToken(pos.line, pos.ch, this.current);
		ide.plugins.trigger('token', this.editor, this.current);
	}

}

class SourceFileFeature extends ide.feature.FileFeature {

	parse(encoding)
	{
		this.encoding = encoding || ide.project.get('editor.encoding');
		return super.parse(encoding);
	}

	render()
	{
		this.editor.listenToCM('change',
			cxl.debounce(this.onChange.bind(this), 100));
		super.render();
	}

	onChange()
	{
		this.content = this.editor.editor.getValue();
		this.editor.header.changed = this.hasChanged();
		ide.plugins.trigger('file.change', this);
	}

	update()
	{
	var
		cm = this.editor.editor,
		// TODO figure out a way not to scroll
		cursor = cm.getCursor()
	;
		cm.setValue(this.content, false);
		cm.setCursor(cursor, null, { scroll: false });
	}

}

/**
 * Events:
 *
 * tokenchange
 * cursorchange
 */
class SourceEditor extends ide.FileEditor {

	$setFocus()
	{
		if (!this.editor.hasFocus())
			this.editor.focus();

		if (ide.editor !== this)
			ide.workspace.focusEditor(this);
	}

	cmd(fn, args)
	{
		if (!isNaN(fn))
			return this.cursor.go(fn);

		return super.cmd(fn, args);
	}

	_findMode()
	{
	var
		filename = this.file.name,
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

	listenToCM(ev, cb)
	{
		const fn = cb.bind(this);
		this.editor.on(ev, fn);
		const s = { destroy: this.editor.off.bind(this.editor, ev, fn) };
		this.bindings.push(s);
		return s;
	}

	render(p)
	{
		super.render(p);
	var
		ft = this.mode = this._findMode(),
		options = this.options = new CodeMirrorOptions(ft),
		editor = this.editor = codeMirror(this.$content, options),
		onFocus = this.$setFocus.bind(this)
	;
		this.encoding = ide.project.get('editor.encoding') || 'utf8';
		// TODO
		if (p.startLine)
			setTimeout(editor.setCursor.bind(editor, p.startLine));

		if (this.encoding !== ide.project.get('editor.encoding'))
			this.setTag('editor.encoding', this.encoding);

		this.keymap.handle = this._keymapHandle.bind(this);

		this.listenTo(ide.plugins, 'workspace.resize', this.resize);

		this.listenTo(this.el, 'focus', onFocus);
		this.listenToCM('focus', onFocus);
	}

	resize()
	{
		setTimeout(this.editor.refresh.bind(this.editor), 200);
	}

}

SourceEditor.features(
	SourceHintsFeature, SourceFileFeature,
	SourceInsertFeature, SourceCursorFeature, SourceScrollFeature, SourceSelectionFeature,
	SourceLineFeature, SourceHistoryFeature, SourceWordFeature, SourcePageFeature,
	SourceTokenFeature, SourceSearchFeature, SourceIndentFeature, SourceFoldFeature,
	SourceRangeFeature
);

ide.SourceToken = SourceToken;
ide.SourceEditor = SourceEditor;
ide.defaultEdit = function(options)
{
	var file = options.file || new ide.File();

	if (!file.content)
		file.content = '';

	var editor = new ide.SourceEditor({
		file: file,
		slot: options.slot,
		startLine: +options.line
	});

	return editor;
};

})(this.ide, this.cxl, this.CodeMirror);
