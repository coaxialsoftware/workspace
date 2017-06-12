/**
 * @license
 *
 */

(function(cxl) {
"use strict";

var
	ide = window.ide = { version: '2.0.2' }
;

class Hint {

	constructor(p)
	{
		this.priority = p.priority || 0;
		this.className = p.className || 'log';
		this.icon = p.icon;
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
			this.$renderElements(this);
			this.$appendChildren();
		}

		return this.el;
	}

	$appendChildren()
	{
		var el = this.el;

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

		if (obj.description)
			desc.innerHTML = obj.description;
	}

	// TODO do we need escaping?
	$renderTitle(obj)
	{
		var title = obj.title;

		if (obj.matchStart!==undefined)
		{
			title = title.slice(0, obj.matchStart) + '<b>' +
				title.slice(obj.matchStart, obj.matchEnd) + '</b>' +
				title.slice(obj.matchEnd);
		}

		if (!this.titleEl)
			this.titleEl = document.createElement('ide-item-title');

		this.titleEl.innerHTML = title;
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
		if (obj.title) this.$renderTitle(obj);
	}

	destroy()
	{

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
	}

	$renderTags(obj)
	{
		if (this.tagsEl)
			this.tagsEl.innerHTML = '';
	var
		el = this.tagsEl || (this.tagsEl = document.createElement('ide-item-tags')),
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
		if (!obj.key && obj.action)
		{
			var key = ide.keyboard.findKey(obj.action);
			obj.key = key ? key : ':' + obj.action;
		}

		if (!this.keyEl)
			this.keyEl = document.createElement('kbd');
		this.keyEl.innerHTML = obj.key||'';
	}

	$renderCode(obj)
	{
		this.codeEl = document.createElement('code');
		this.codeEl.innerHTML = obj.code||'';
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
		if (this.titleEl) el.appendChild(this.titleEl);
		if (this.keyEl) el.appendChild(this.keyEl);
		if (this.descEl) el.appendChild(this.descEl);
	}

	remove()
	{
		if (this.el && this.el.parentNode)
			this.el.parentNode.removeChild(this.el);
	}

}

class DynamicItem extends Item {

	$renderElements(obj)
	{
	var
		el = this.el = document.createElement('ide-item')
	;
		el.tabIndex = 0;
		el.className = 'item ' + obj.className;

		this.$renderIcon(obj);
		this.$renderDescription(obj);
		this.$renderTitle(obj);
		this.$renderKey(obj);
		this.$renderCode(obj);
		this.$renderTags(obj);
	}

	$renderIcon(obj)
	{
		var el;

		if (obj.$icon)
		{
			el = ide.resources.getIcon(obj.$icon);

			if (this.iconEl)
			{
				this.el.insertBefore(el, this.iconEl);
				this.el.removeChild(this.iconEl);
			} else
				this.iconEl = el;
		}
		else
			this.iconEl = document.createElement('span');
	}

	get icon() { return this.$icon; }
	set icon(val) {
		if (this.$icon!==val)
		{
			this.$icon = val;
			this.$renderIcon(this);
		}
	}

	get key() { return this.$key; }
	set key(val) {
		this.$key = val;
		if (this.keyEl) this.keyEl.innerHTML = val || '';
	}

	get action() { return this.$action; }
	set action(val) {
		this.$action = val;
		if (this.keyEl) this.$renderKey(this);
	}

	get title() { return this.$title; }
	set title(val) {
		this.$title = val;
		if (this.titleEl) this.$renderTitle(this);
	}

	get code() { return this.$code; }
	set code(val) {
		this.$code = val;
		if (this.codeEl) this.codeEl.innerHTML = val || '';
	}

	get description() { return this.$description; }
	set description(val) {
		this.$description = val;
		if (this.descEl) this.descEl.innerHTML = val || '';
	}

	get tags() { return this.$tags; }
	set tags(val) {
		if (this.$tags !== val)
		{
			this.$tags = val;
			this.$renderTags(this);
		}
	}

	get className() { return this.$className; }
	set className(val) {
		if (this.$className !== val)
		{
			this.$className = val;
			if (this.el) this.el.className = 'item ' + (val || 'log');
		}
	}

}

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
		tag: iconEl('tag'),
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

	Range: Range,
	resources: ResourceManager,
	Item: Item,
	DynamicItem: DynamicItem,
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
