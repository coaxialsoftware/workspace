
(function(ide, cxl) {
"use strict";

var editorId = 1;

/**
 * A feature defines a set of functions and commands for an Editor.
 */
class Feature {

	constructor(editor)
	{
		this.editor = editor;
		editor[this.constructor.featureName] = this;
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
		this.editor.listenTo(this.$close, 'click', this.onClose);
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

	onClose(ev)
	{
		ev.preventDefault(); ev.stopPropagation();
		ide.workspace.remove(this);
	}

	createTag(id)
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
			el = this.createTag(id);

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

class FocusFeature extends Feature
{
	render()
	{
		this.editor.listenTo(this.editor.el, 'click', this.set.bind(this));
	}

	blur()
	{
		ide.editor = null;
		this.editor.el.classList.remove('focus');
	}

	/**
	 * Focus editor. Sets ide.editor.
	 */
	set()
	{
		if (ide.editor === this.editor)
			return;

		if (ide.editor)
			ide.editor.focus.blur();

		ide.editor = this.editor;

		this.editor.el.classList.add('focus');
		ide.plugins.trigger('editor.focus', this.editor);
	}

}

FocusFeature.featureName = 'focus';

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
}

HintsFeature.featureName = 'hints';

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
	'selection.remove': function() { this.selection.remove(); }
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

class TokenFeature extends Feature { }

TokenFeature.featureName = 'token';

class RangeFeature extends Feature { }

RangeFeature.featureName = 'range';

class Token {

	get cursorValue()
	{
		// TODO ?
		return this.$cursorValue===undefined ?
			(this.$cursorValue=this.value.substr(0, this.cursorColumn-this.column)) :
			this.$cursorValue
		;
	}

	set cursorValue(val)
	{
		this.$cursorValue = val;
	}

	toJSON()
	{
		return this.$json || (this.$json={
			row: this.row,
			column: this.column,
			cursorColumn: this.column,
			cursorRow: this.row,
			type: this.type,
			value: this.value,
			cursorValue: this.cursorValue
		});
	}

}

class Range { }

class FileFeature {

	constructor(editor, config)
	{
		this.editor = editor;
		editor.file = this.file = config.file;
		editor.listenTo(ide.plugins, 'file.parse', this.onFileParse.bind(this));
	}

	// TODO Listening to ide.plugins for this might be dangerous
	onFileParse(file)
	{
		if (file!==this.file)
			return;

		this.read(file);
	}

	destroy()
	{
		this.editor.file.destroy();
	}

}

function fileFormatApply(from, to)
{
var
	file = ide.editor.file,
	content
;
	if (file instanceof ide.File)
	{
		content = file.content;
		file.setContent(content.replace(from, to));
	}
}

FileFeature.featureName = 'file';
FileFeature.commands = {

	w: 'write',
	f: 'file',

	file: function()
	{
		ide.notify(ide.editor.file ?
			ide.editor.file.id || '[No Name]' :
			'No files open.');
	},

	save: 'write',

	write: function(filename, force)
	{
		this.file.write(filename, force);
	},

	'w!': function(filename)
	{
		this.file.write(filename, true);
	},

	'fileformat.unix': {
		description: 'Set the file line end format to "\\n"',
		fn: function() { fileFormatApply(/\r\n?/g, "\n"); }
	},

	'fileformat.dos': {
		description: 'Set the file line end format to "\\r\\n"',
		fn: function() { fileFormatApply(/\r?\n/g, "\r\n"); }
	},

	'fileformat.mac': {
		description: 'Set the file line end format to "\\r"',
		fn: function() { fileFormatApply(/\r?\n/g, "\r"); }
	}

};

class FileHashFeature extends HashFeature {

	render()
	{
		// Update hash on file.parse in case file name changes.
		this.editor.listenTo(ide.plugins, 'file.parse', function() {
			ide.workspace.update();
		});
	}

	get()
	{
	var
		editor = this.editor,
		cmd = editor.command || '',
		args = editor.arguments ? this.serializeArgs(editor.arguments) :
			(editor.file.filename || '')
	;
		return (cmd ? cmd+':' : '') + args;
	}

}

class Editor {

	constructor(p)
	{
		this.id = editorId++;
		this.bindings = [];
		this.plugin = p.plugin;
		this.el = document.createElement('DIV');
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

Editor.features(HashFeature, EditorHeader, FocusFeature);

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


Object.assign(ide, {
	Feature: Feature,
	HistoryRecord: HistoryRecord,
	Token: Token,
	Editor: Editor,
	Range: Range,
	ComponentEditor: ComponentEditor
});

ide.feature = {
	FileFeature: FileFeature,
	FileHashFeature: FileHashFeature,
	EditorHeader: EditorHeader,
	CursorFeature: CursorFeature,
	FocusFeature: FocusFeature,
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


})(this.ide, this.cxl);