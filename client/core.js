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

class HintTemplate {

	render(obj)
	{
		this.$renderElements(obj);
		this.$appendChildren();

		return this.el;
	}

	$appendChildren()
	{
		var el = this.el;

		if (this.svgIconEl) el.appendChild(this.svgIconEl);
		if (this.iconEl) el.appendChild(this.iconEl);
		if (this.titleEl) el.appendChild(this.titleEl);
		if (this.descEl) el.appendChild(this.descEl);
	}

	$renderIcon(obj)
	{
		this.iconEl = ide.resources.getIcon(obj.icon);
	}

	$renderDescription(obj)
	{
		var desc = this.descEl = document.createElement('ide-item-description');
		desc.innerHTML = obj.description;
	}

	// TODO do we need escaping?
	$renderTitle(obj)
	{
		var title = this.titleEl = document.createElement('ide-item-title');
		title.innerHTML = obj.title;
	}

	$renderElements(obj)
	{
	var
		el = this.el = document.createElement('ide-item')
	;
		el.tabIndex = 0;
		el.className = 'item ' + obj.className;

		if (obj.icon) this.$renderIcon(obj);
		if (obj.description) this.$renderDescription(obj);
		if (obj.matchStart!==undefined)
		{
			obj.title = obj.title.slice(0, obj.matchStart) + '<b>' +
				obj.title.slice(obj.matchStart, obj.matchEnd) + '</b>' +
				obj.title.slice(obj.matchEnd);
		}
		if (obj.title) this.$renderTitle(obj);
	}

}

class Hint {

	constructor(p)
	{
		this.priority = p.priority || 0;
		this.className = p.className || 'log';
		this.icon = p.icon;
		this.svgIcon = p.svgIcon;
		this.title = p.title;
		this.description = p.description;
		this.value = 'value' in p ? p.value : p.title;
		this.matchStart = p.matchStart;
		this.matchEnd = p.matchEnd;
	}

	render()
	{
		if (this.el===undefined)
		{
			this.template = new this.Template();
			this.el = this.template.render(this);
		}

		return this.el;
	}

	destroy()
	{

	}

}

Hint.prototype.Template = HintTemplate;


class ItemTemplate extends HintTemplate {

	$renderLink(i)
	{
		return '<' + (i.href ? 'a href="' + i.href + '"' : 'span') +
			' class="icon" title="' + (i.title || i) +
			'"><i class="fa fa-' + (i.class || i) + '"></i>' +
			(i.text||'') + '</' + (i.href ? 'a' : 'span') + '>';
	}

	$renderTags(obj)
	{
	var
		el = this.tagsEl = document.createElement('ide-item-tags'),
		tags = obj.tags,
		tag, i
	;
		for (i in tags)
		{
			if (tags[i])
			{
				tag = document.createElement('ide-tag');
				tag.innerHTML = tags[i];
				el.appendChild(tag);
			}
		}
	}

	$renderIcons(icons)
	{
		return '<div class="icons">' + icons.map(this.$renderIcon).join('') + '</div>';
	}

	$renderKey(obj)
	{
		this.keyEl = document.createElement('kbd');
		this.keyEl.innerHTML = obj.key;
	}

	$renderCode(obj)
	{
		this.codeEl = document.createElement('code');
		this.codeEl.innerHTML = obj.code;
	}

	$renderElements(obj)
	{
		super.$renderElements(obj);

		if (obj.key) this.$renderKey(obj);
		if (obj.code) this.$renderCode(obj);
		if (obj.tags) this.$renderTags(obj);
	}

	$appendChildren()
	{
		var el = this.el;

		if (this.tagsEl) el.appendChild(this.tagsEl);
		if (this.codeEl) el.appendChild(this.codeEl);
		if (this.iconEl) el.appendChild(this.iconEl);
		if (this.svgIconEl) el.appendChild(this.svgIconEl);
		if (this.titleEl) el.appendChild(this.titleEl);
		if (this.keyEl) el.appendChild(this.keyEl);
		if (this.descEl) el.appendChild(this.descEl);
	}

}

class Item extends Hint {

	/**
	 * Options:
	 * key
	 * className
	 * action
	 * value
	 * code
	 */
	constructor(p)
	{
		super(p);

		this.key = p.key;
		this.action = p.action;
		this.code = p.code;
		this.tags = p.tags;

		if (p.enter)
			this.enter = p.enter;

		if (!this.key && this.action)
		{
			var key = ide.keyboard.findKey(this.action);
			this.key = key ? key : ':' + this.action;
		}
	}

}

Item.prototype.Template = ItemTemplate;

class ComponentItem {

	constructor(component)
	{
		this.component = component;
	}

	render()
	{
		if (this.el===undefined)
		{
			this.el = this.component.$native;
			this.el.tabIndex = 0;
		}

		return this.el;
	}

	destroy()
	{
		if (this.component)
			this.component.destroy();
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

		this.id = message.id;
		this.progress = message.progress;
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
		// Item has already been removed ?
		if (item.el.parentNode !== this.el)
			return;

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

		var el = span.render();

		this.el.insertBefore(el, this.el.firstChild);

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

function _start()
{
	cxl.dom.root = new cxl.dom.Element(document.body);

	ide.logger = new Logger();
	ide.workspace = new ide.Workspace();
	ide.hash = new ide.Hash();
	ide.project = new ide.Project({
		path: ide.hash.data.p || ide.hash.data.project
	});
	ide.styles = document.getElementById('styles').sheet;
	ide.searchBar = new ide.Bar.Search();
	ide.commandBar = new ide.Bar.Command();

	ide.project.fetch();
}

function iconEl(id)
{
	var el = document.createElement('ide-icon');
	el.className = id;
	return el;
}

var ResourceManager = {

	$icons: {
		bug: iconEl('bug'),
		command: iconEl('command'),
		cog: iconEl('cog'),
		directory: iconEl('directory'),
		file: iconEl('file'),
		git: iconEl('git'),
		keyword: iconEl('keyword'),
		property: iconEl('property'),
		project: iconEl('project'),
		settings: iconEl('settings'),
		variable: iconEl('variable'),
		'variable-global': iconEl('variable-global'),
		expand: iconEl('expand'),
		collapse: iconEl('collapse')
	},

	getIcon: function(id)
	{
		return this.$icons[id].cloneNode(true);
	},

	registerIcon: function(id)
	{
		return (this.$icons[id] = iconEl(id));
	},

	registerSVGIcon: function(id, content, viewbox)
	{
		var svg = this.$icons[id] = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
		svg.innerHTML = content;
		svg.setAttribute('class', 'ide-icon');
		svg.setAttribute('viewBox', viewbox);
		return svg;
	}

};

Object.assign(ide, {

	/** Used by commands to indicate that the command wasn't handled. */
	Pass: {},

	Feature: Feature,
	Token: Token,
	Range: Range,
	HistoryRecord: HistoryRecord,
	resources: ResourceManager,

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
	ComponentEditor: ComponentEditor,
	ItemTemplate: ItemTemplate,
	Item: Item,
	ComponentItem: ComponentItem,
	Hint: Hint,
	Notification: Notification,

	// Svg Cache
	SVG: {},

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

	styles: null,

	confirm: cxl.ui.confirm,

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

/**
 * Opens a file.
 * @param {object|ide.File} options If string it will be treated as target
 *
 * options.file {ide.File|string} Name of the file relative to project or a File object.
 * options.plugin Specify what plugin to use.
 *
 * @return {Promise}
 */
ide.open = function(options)
{
	if (options instanceof ide.File)
		options = { file: options };

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
