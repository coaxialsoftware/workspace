/**
 * @license
 *
 */

(function(cxl) {
"use strict";
	
var
	ide = window.ide = { version: '2.0.2' },
	editorId = 1
;
	
class Item {
	
	/**
	 * Options:
	 * key
	 * className
	 * action
	 * value
	 */
	constructor(p)
	{
		this.priority = 0;
		this.className = 'log';
		
		Object.assign(this, p);
		
		if (!this.key && this.action)
		{
			var key = ide.keyboard.findKey(this.action);
			this.key = key ? key : ':' + this.action;
		}
		
		if (this.value===undefined)
			this.value = this.title;
		
		this.el = this.template(this);
	}
	
	$renderIcon(i)
	{
		return '<' + (i.href ? 'a href="' + i.href + '"' : 'span') +
			' class="icon" title="' + (i.title || i) +
			'"><i class="fa fa-' + (i.class || i) + '"></i>' + 
			(i.text||'') + '</' + (i.href ? 'a' : 'span') + '>';
	}
	
	$renderTags(tags)
	{
		var result='', i;
		
		for (i in tags)
		{
			if (tags[i])
				result += '<span class="label pull-right">' + tags[i] + '</span>';
		}
		
		return result;
	}
	
	$renderIcons(icons)
	{
		return '<div class="icons">' + icons.map(this.$renderIcon).join('') + '</div>';
	}

	template(obj)
	{
	var
		el=document.createElement('ide-item'),
		tags = obj.tags ? this.$renderTags(obj.tags) : ''
	;
		el.tabIndex = 0;
		el.className = 'item ' + obj.className;
		el.innerHTML = tags +
			(obj.code ? '<code>' + obj.code + '</code>' : '') +
			 '<div class="item-body">' +
			(obj.key ? '<kbd>' + obj.key + '</kbd>' : '') +
			(obj.icon ? this.$renderIcon(obj.icon) : '') +
			(obj.title ? '<h4>' + obj.title + '</h4>' : '') +
			(obj.description ? '<span class="description">' + obj.description + '</span>' : '') +
			(obj.icons ? this.$renderIcons(obj.icons) : '') +
			'</div>' + (obj.html || '')
		;
		
		return el;
	}
	
	destroy()
	{
	}

}
	
class Notification extends Item {

	/** Optional Id for progress hints */
	//id: null,

	/**
	 * If present hint will persist until progress becomes 1.
	 * Progress from 0.0 to 1.0. A value of -1 will show a spinner
	 */
	//progress: null,

	constructor(message, kls)
	{
		if (typeof(message)==='string')
			message = { title: message, className: kls };
		
		super(message);
	}

}
	
class Logger {
	
	constructor()
	{
		this.active = {};
		this.items = [];
		this.el = document.getElementById('notification');
		this.delay = 3000;
	}
	
	remove(item)
	{
		if (item.id)
			delete(this.active[item.id]);

		this.el.removeChild(item.el);
		this.items.unshift(item);
		if (this.items.length>100)
			this.items.length = 100;
	}
	
	notify(span)
	{
		if (span.id)
		{
			var old = span.id && this.active[span.id];

			if (old)
				this.remove(old);

			this.active[span.id] = span;
		}

		this.el.insertBefore(span.el, this.el.firstChild);

		if (span.progress === null || span.progress === undefined || span.progress===1)
			setTimeout(this.remove.bind(this, span), this.delay);

		return span;
	}
}

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
			'<span class="modified"></span><span class="title"></span>';

		this.$close = el.childNodes[0];
		this.$tags = el.childNodes[1];
		this.$changed = el.childNodes[2];
		this.$title = el.childNodes[3];
		this._title = '';
		this.changed = false;
	}
	
	render()
	{
		this.editor.el.appendChild(this.el);
		this.editor.listenTo(this.$close, 'click', this.onClose);
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
			el: document.createElement('SPAN')
		};
		
		this.$tags.appendChild(tag.el);
		tag.el.className = 'label';
		
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
		// TODO ?
		var result='', i,l;
		
		if (args && args.length)
		{
			l = args.length-1;
			for (i=0; i<l; i++)
				result += args[i] + ' ';
			result += args[i];
		}
		
		return result;	
	}

	get()
	{
	var
		editor = this.editor,
		p = editor.plugin && editor.plugin.name,
		cmd = editor.command || '',
		args = this.serializeArgs(editor.arguments)
	;
		return (p && cmd ? p + '.' : p || '') + cmd + ':' + args;
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

class Range {


}
	
class Editor {

	constructor(p)
	{
		this.id = editorId++;
		this.bindings = [];
		this.plugin = p.plugin;
		this.el = document.createElement('DIV');
		this.keymap = new ide.KeyMap(this);
		this.command = p.command;
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

			this.commands[i] = fn; 
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
	var
		method = el.addEventListener || el.on,
		remove = el.removeEventListener || el.off,
		fn = cb.bind(this),
		subscriber = method.call(el, event, cb.bind(this))
	;
		if (!(subscriber instanceof cxl.rx.Subscriber))
			subscriber = { unsubscribe: remove.bind(el, event, fn) };
			
		this.bindings.push(subscriber);
		
		return subscriber;
	}
	
	destroy()
	{
		cxl.invokeMap(this.bindings, 'unsubscribe');
		cxl.invokeMap(this.features, 'destroy');
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
	}

}
	
Editor.features(HashFeature, EditorHeader, FocusFeature);
	
function onProject()
{
	ide.plugins.start();
	ide.keymap.start();
	ide.plugins.ready();
	ide.hash.loadFiles();
}

function _start()
{
	ide.logger = new Logger();
	ide.workspace = new ide.Workspace();
	ide.hash = new ide.Hash();
	ide.project = new ide.Project({
		path: ide.hash.data.p || ide.hash.data.project
	});
	
	ide.project.fetch().catch(function() {
		ide.error('Error loading project "' + ide.project.id + '"');
		ide.hash.set({ p: null });
		ide.project.set('path', '.');
		return ide.project.fetch();
	}).then(onProject);

	
	ide.searchBar = new ide.Bar.Search();
	ide.commandBar = new ide.Bar.Command();
}
		
Object.assign(ide, {

	/** Used by commands to indicate that the command wasn't handled. */
	Pass: {},
		
	Feature: Feature,
	Token: Token,
	Range: Range,
	HistoryRecord: HistoryRecord,

	feature: {
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
	},

	Editor: Editor,
	Item: Item,
	Notification: Notification,

	/** Current opened project */
	project: null,

	/** Current workspace */
	workspace: null,

	/** Current WebSocket */
	socket: null,

	/** Plugin Manager */
	plugins: null,

	/** Displays alert notification on right corner */
	warn: function(message)
	{
		return ide.notify(message, 'warn');
	},

	/** Displays error notification on right corner */
	error: function(message)
	{
		window.console.error(message);
		return ide.notify(message, 'error');
	},

	source: function(src)
	{
		/* jshint evil:true */
		return (new Function(src)).call(window);
	},

	/**
	 * Opens file in new tab
	 */
	openTab: function(file, target)
	{
		return Promise.resolve(window.open(
			'#' + ide.hash.encode({ f: file || false }),
			target || '_blank'
		));
	},

	/**
	 * Opens a file.
	 * @param {object|string|ide.File} options If string it will be treated as target
	 *
	 * options.file {ide.File|string} Name of the file relative to project or a File object.
	 * options.plugin Specify what plugin to use.
	 *
	 * @return {Promise}
	 */


	/** Displays notification on right corner */
	notify: function(message, kls)
	{
	var
		span = message instanceof ide.Item ? message :
			new Notification(message, kls)
	;
		return ide.logger.notify(span);
	}
		
});
	
function loadFile(file)
{
	return file.content || !file.filename ? Promise.resolve(file) : file.fetch();
}
	
function findPlugin(options)
{
	if (options.plugin)
	{
		return options.command ?
			options.plugin.commands[options.command].call(options.plugin, options.params) :
		options.plugin.open(options);
	}
	
	return ide.plugins.findPlugin(options);
}

function loadEditor(options, file)
{
	options.file = file;
	var editor = findPlugin(options);

	options.slot.setEditor(editor);

	if (options.focus!==false)
		editor.focus.set();

	return editor;
}

function onOpenError(options, e)
{
	if (options.slot)
		ide.workspace.removeSlot(options.slot);

	ide.error('Error opening editor.');
	window.console.error(e);

	return Promise.reject(e);
}
	
ide.open = function(options)
{
	options.slot = options.slot || ide.workspace.slot();

	if (options.file && !(options.file instanceof ide.File))
		options.file = new ide.File(options.file);

	return (options.file ? loadFile(options.file).then(loadEditor.bind(ide, options)) :
		Promise.resolve(loadEditor(options))).catch(onOpenError.bind(ide, options));
};

	if (document.readyState!=='loading')
		window.setTimeout(_start);
	else
		window.addEventListener('DOMContentLoaded', _start);

	window.addEventListener('error', function(msg) {
		ide.error(msg.message);
	});

})(this.cxl);
