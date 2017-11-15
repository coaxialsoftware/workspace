
(function(ide, cxl, XTerminal) {
"use strict";

var editorId = 1;

/**
 * A feature defines a set of functions and commands for an Editor.
 */
class Feature {

	constructor(editor)
	{
		var name = this.constructor.featureName;

		this.editor = editor;
		editor.$assistData[name] = true;
		editor[name] = this;
	}

}

class EditorHeader extends Feature {

	constructor(e)
	{
		super(e);

		var el = this.el = document.createElement('ide-editor-header');

		this.tags = {};

		el.innerHTML = '<div class="close"></div><div class="tags"></div>' +
			'<span class="modified"></span><span class="project"></span>' +
			'<span class="title"></span>';

		this.$close = el.childNodes[0];
		this.$tags = el.childNodes[1];
		this.$changed = el.childNodes[2];
		this.$project = el.childNodes[3];
		this.$title = el.childNodes[4];
		this._title = '';
		this.changed = false;
	}

	render()
	{
		this.editor.el.appendChild(this.el);
		this.editor.listenTo(this.$close, 'click', this.$onClose);
		this.$project.innerHTML = '[' + ide.project.id + '] ';
	}

	set title(title)
	{
		if (this._title!==title)
			this.$title.innerHTML = this._title = title;
	}

	get title()
	{
		return this._title;
	}

	set changed(val)
	{
		if (this._changed!==val)
		{
			this._changed = val;
			this.$changed.style.display = val ? 'inline' : 'none';
		}
	}

	get changed()
	{
		return this._changed;
	}

	$onClose(ev)
	{
		ev.preventDefault(); ev.stopPropagation();
		ide.workspace.remove(this);
	}

	$createTag(id)
	{
		var tag = this.tags[id] = {
			el: document.createElement('ide-tag')
		};

		this.$tags.appendChild(tag.el);

		return tag;
	}

	setTag(id, text, kls)
	{
		var el = this.tags[id];

		if (!el)
			el = this.$createTag(id);

		if (text !== undefined && el.text !== text)
			el.el.innerHTML = el.text = text;

		if (kls !== undefined && kls !== el.kls)
		{
			el.kls = kls;
			el.el.className = 'label ' + (kls || '');
		}
	}

}

EditorHeader.featureName = 'header';

class CursorFeature extends Feature {}

CursorFeature.featureName = 'cursor';
CursorFeature.commands = {
	'cursor.goUp': function() { this.cursor.goUp(); },
	'cursor.goDown': function() { this.cursor.goDown(); },
	'cursor.goForward': function() { this.cursor.goForward(); },
	'cursor.goBackwards': function() { this.cursor.goBackwards(); },
	'cursor.goStart' : function() { this.cursor.goStart(); },
	'cursor.goEnd' : function() { this.cursor.goEnd(); },
	'cursor.enter': function(shift, mod) { this.cursor.enter(shift, mod); }
};

class FoldFeature extends Feature {

	toggle()
	{
		if (this.isFolded())
			this.open();
		else
			this.close();
	}

}

FoldFeature.featureName = 'fold';
FoldFeature.commands = {
	'fold.toggle': function() { this.fold.toggle(); },
	'fold.open': function() { this.fold.open(); },
	'fold.close': function() { this.fold.close(); }
};

class HintsFeature extends Feature {

	constructor(e)
	{
		super(e);
		this.hints = [];
	}

	render()
	{
		this.editor.listenTo(ide.plugins, 'assist', this.onAssist.bind(this));
	}

	onAssist(req)
	{
		var hints;

		if (req.extended && req.editor===this.editor)
		{
			hints = this.getLine(req.editor.cursor.row);
			req.respondExtended(hints);
		}
	}

	setHints(hints, id)
	{
		this.clear(id);
		hints.forEach(this.add.bind(this));
	}

	clear(code)
	{
		this.get(code).forEach(this.remove.bind(this));
	}

	get(code)
	{
		return code===undefined ? this.hints : this.hints.filter(function(h) {
			return h.code===code;
		});
	}

	// TODO add validation in debug module
	add(hint)
	{
		if (!(hint instanceof ide.Item))
			hint = new ide.Item(hint);

		this.hints.push(hint);

		return hint;
	}

	remove(hint)
	{
		hint.remove();
		hint.destroy();
		cxl.pull(this.hints, hint);
	}

	getLine(line, code)
	{
		return this.hints.filter(function(h) {
			return (code===undefined || h.code===code) && h.range.row === line;
		});
	}

}

HintsFeature.featureName = 'hints';
HintsFeature.commands = {
	'hints': function(code) {
	var
		list = new ide.ListEditor({ }),
		hints = this.hints.get(code)
	;
		list.add(hints);
		return list;
	}
};

class InsertFeature extends Feature {

	read(file)
	{
		//file = file || ide.editor.file.filename;
		cxl.ajax.get('/file?p=' + ide.project.id + '&n=' + file)
			.then(function(content) {
				if (content.new)
					ide.notify('File does not exist.');
				else
					this.editor.insert(content.content.toString());
			}, function(err) {
				ide.error(err);
			});
	}

}

InsertFeature.featureName = 'insert';
InsertFeature.commands = {
	'insert.enable': function() { this.insert.enable(); },
	'insert.disable': function() { this.insert.disable(); },
	'insert.line': function() { this.insert.line(); },
	'insert.tab': function() { this.insert.tab(); },
	'insert.backspace': function() { this.insert.backspace(); },
	'insert.del': function() { this.insert.del(); }
};

class IndentFeature extends Feature {

}

IndentFeature.featureName = 'indent';
IndentFeature.commands = {
	'indent.more': function() { this.indent.more(); },
	'indent.less': function() { this.indent.less(); },
	'indent.auto': function() { this.indent.auto(); }
};

class HashFeature extends Feature {

	serializeArgs(args)
	{
		if (!args)
			return '';

		if (args.length===1)
			return args[0]+'';

		return JSON.stringify(args);
	}

	get()
	{
	var
		editor = this.editor,
		cmd = editor.command || '',
		args = this.serializeArgs(editor.arguments)
	;
		return cmd + ':' + args;
	}
}

HashFeature.featureName = 'hash';

class SearchFeature extends Feature {

	replace(val, replace)
	{
		var range = this.search(val);
		return range && range.replace(replace);
	}

}

SearchFeature.featureName = 'search';
SearchFeature.commands = {
	'search.next': function(val) { this.search.search(val); },
	'search.previous': function(val) { this.search.search(val, true); },
	'search.replace': function(val, replace) { this.search.replace(val, replace); },
	'search': 'search.next'
};

class ScrollFeature extends Feature { }

ScrollFeature.featureName = 'scroll';

class SelectionFeature extends Feature {

}

SelectionFeature.featureName = 'selection';
SelectionFeature.commands = {
	'selection.begin': function() { this.selection.begin(); },
	'selection.end': function() { this.selection.end(); },
	'selection.clear': function() { this.selection.clear(); },
	'selection.remove': function() { this.selection.remove(); },
	'selection.selectAll': function() { this.selection.selectAll(); }
};

class LineFeature extends Feature {

	select()
	{
	}

	goStart()
	{
		var e = this.editor;
		e.cursor.go(this.row, this.column);
	}

	goEnd()
	{
		var e = this.editor;
		e.cursor.go(this.rowEnd, this.columnEnd);
	}

	moveDown()
	{
	}

	moveUp()
	{
	}

}

LineFeature.featureName = 'line';
LineFeature.commands = {
	'line.select': function() { this.line.select(); },
	'line.goStart': function() { this.line.goStart(); },
	'line.goEnd': function() { this.line.goEnd(); },
	'line.remove': function() { this.line.remove(); },
	'line.moveDown': function() { this.line.moveDown(); },
	'line.moveUp': function() { this.line.moveUp(); }
};

// TODO
class HistoryRecord {

	constructor(type)
	{
		this.type = type;
	}

}

class HistoryFeature extends Feature {

	openHistory()
	{
	var
		children = this.getAll().map(function(h) {
			return { code: h.type };
		}),
		editor
	;
		editor = new ide.ListEditor({
			title: 'history',
			children: children
		});

		return editor;
	}

}

HistoryFeature.featureName = 'history';
HistoryFeature.commands = {
	'history': function() { return this.history.openHistory(); },
	'history.undo': function() { this.history.undo(); },
	'history.redo': function() { this.history.redo(); },
	'history.lastInsert': function() { return this.history.lastInsert; }
};

class WordFeature extends Feature {

	goNext()
	{
		this.cursor.go(undefined, this.word.current.endColumn);
		this.cursor.goForward();
	}

	goPrevious()
	{
		this.cursor.go(undefined, this.word.current.startColumn);
	}

}

WordFeature.featureName = 'word';
WordFeature.commands = {
	'word.goNext': function() { return this.word.goNext(); },
	'word.goPrevious': function() { return this.word.goPrevious(); },
	'word.removeNext': function() {	return this.word.removeNext(); },
	'word.removePrevious': function() { return this.word.removePrevious(); }
};

class PageFeature extends Feature {

	goUp()
	{
		this.editor.cursor.go(this.current.row);
	}

	goDown()
	{
		this.editor.cursor.go(this.current.endRow);
	}

}

PageFeature.featureName = 'page';
PageFeature.commands = {
	'page.goUp': function() { this.page.goUp(); },
	'page.goDown': function() { this.page.goDown(); }
};

class TokenFeature extends Feature {

	/** @abstract */
	getToken()
	{
	}

}

TokenFeature.featureName = 'token';

class RangeFeature extends Feature { }

RangeFeature.featureName = 'range';

class Range {
	// row
	// column
	// endRow
	// endColumn
}

class Token extends Range {

	get cursorValue()
	{
		// TODO ?
		return this.$cursorValue===undefined ?
			(this.$cursorValue=this.value&&this.value.substr(0, this.cursorColumn-this.column)) :
			this.$cursorValue
		;
	}

	set cursorValue(val)
	{
		this.$cursorValue = val;
	}

	next()
	{
		return this.editor.token.getToken(this.endRow, this.endColumn+1);
	}

	previous()
	{
		return this.editor.token.getToken(this.row, this.column);
	}

	toJSON()
	{
		return {
			row: this.row,
			column: this.column,
			cursorColumn: this.column,
			cursorRow: this.row,
			type: this.type,
			value: this.value,
			cursorValue: this.cursorValue
		};
	}

}

class Editor {

	constructor(p)
	{
		this.id = editorId++;
		this.bindings = [];
		this.plugin = p.plugin;
		this.el = document.createElement('DIV');

		this.$assistData = {};
		this.$assistPromises = [];

		// TODO ?
		this.el.$editor = this;
		this.keymap = new ide.KeyMap(this);
		this.command = p.command;
		this.arguments = p.arguments;
		this.features = {};

		this.loadFeatures(p);

		ide.plugins.trigger('editor.load', this);
	}

	static registerCommands(cmds)
	{
		var fn, i;

		if (!this.hasOwnProperty('commands'))
			this.commands = Object.assign({}, this.commands);

		for (i in cmds)
		{
			fn = cmds[i];

			if (typeof(fn)==='string')
				fn = cmds[fn];

			this.commands[i] = new ide.Command(i, fn);
		}
	}

	static features()
	{
		if (!this.hasOwnProperty('$features'))
			this.$features = Object.assign({}, this.$features);

		for (var Feature of arguments)
		{
			this.$features[Feature.featureName] = Feature;

			if (Feature.commands)
				this.registerCommands(Feature.commands);
		}

		return this.$features;
	}

	supports(featureName)
	{
		return featureName in this.features;
	}

	loadFeatures(p)
	{
		var features = this.constructor.$features, i;

		for (i in features)
			this.features[i] = new features[i](this, p);

		this.render(p);

		cxl.invokeMap(this.features, 'render');
	}

	getAssistData()
	{
	var
		features = this.features,
		data = this.$assistData,
		promises = this.$assistPromises,
		result, i, f
	;
		promises.length = 0;

		for (i in features)
		{
			f = features[i];

			if (f.assist)
			{
				result = f.assist(data[i]);
				if (result)
					promises.push(result);
			}
		}

		return cxl.Promise.all(promises).then(() => data);
	}

	/**
	 * Render editor content.
	 */
	render(p)
	{
		var title = p.title || p.command;

		this.$content = document.createElement('ide-editor-content');

		this.el.appendChild(this.$content);

		if (title)
			this.header.title = title;
	}

	focus()
	{
		ide.workspace.focusEditor(this);
	}

	/**
	 * Listen to events. Supports addEventListener, and on/off methods.
	 * Adds subscriber to this.bindings and returns it.
	 */
	listenTo(el, event, cb)
	{
		var s = cxl.listenTo(el, event, cb.bind(this));

		this.bindings.push(s);

		return s;
	}

	destroy()
	{
		cxl.invokeMap(this.bindings, 'unsubscribe');
		cxl.invokeMap(this.features, 'destroy');
		this.bindings = null;
		this.features = null;
	}

	/**
	 * Handles a single command. Returns ide.Pass if command wasn't handled.
	 *
	 * @param name
	 * @param args
	 */
	cmd(name, args)
	{
		var fn = this.constructor.commands && this.constructor.commands[name];

		return fn ? fn.apply(this, args) : ide.Pass;
	}

	/**
	 * Handles closing the editor. Return a string to confirm with user first.
	 */
	quit()
	{
		this.destroy();
	}

}

Editor.features(HashFeature, EditorHeader);

class ComponentEditor extends Editor {

	render(p)
	{
		super.render(p);

		this.$component = p.component(p);
		this.$content.appendChild(this.$component.$native);
	}

	destroy()
	{
		super.destroy();
		this.$component.destroy();
	}

}

class BrowserEditor extends Editor {

	render(p)
	{
		super.render(p);

		this.$iframe = document.createElement('IFRAME');
		this.$iframe.className = 'ide-browser';
		this.$content.appendChild(this.$iframe);

		if (p.url)
			this.$iframe.src = p.url;
	}

}

class Terminal extends Editor {

	$onFocus()
	{
		this.$onResize();
		this.$term.focus();
	}

	$onResize()
	{
		this.$term.fit();
	}

	render(p)
	{
		super.render(p);

		var term = this.$term = new XTerminal();
		term.open(this.$content, { focus: false });

		this.listenTo(this.el, 'focus', this.$onFocus.bind(this));
		this.listenTo(ide.plugins, 'workspace.resize', this.$onResize.bind(this));
	}

}

Object.assign(ide, {
	Feature: Feature,
	HistoryRecord: HistoryRecord,
	Token: Token,
	Editor: Editor,
	Range: Range,
	ComponentEditor: ComponentEditor,
	BrowserEditor: BrowserEditor,
	Terminal: Terminal
});

ide.feature = {
	EditorHeader: EditorHeader,
	CursorFeature: CursorFeature,
	FoldFeature: FoldFeature,
	SearchFeature: SearchFeature,
	HashFeature: HashFeature,
	ScrollFeature: ScrollFeature,
	SelectionFeature: SelectionFeature,
	LineFeature: LineFeature,
	HistoryFeature: HistoryFeature,
	WordFeature: WordFeature,
	PageFeature: PageFeature,
	TokenFeature: TokenFeature,
	InsertFeature: InsertFeature,
	HintsFeature: HintsFeature,
	IndentFeature: IndentFeature,
	RangeFeature: RangeFeature
};


})(this.ide, this.cxl, this.Terminal);