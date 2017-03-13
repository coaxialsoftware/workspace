/**
 * @license
 *
 */

(function(cxl) {
"use strict";
	
var
	ide = window.ide = { version: '2.0.0' }
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
	
class EditorHeader {
	
	constructor(editor)
	{
		var el = this.el = document.createElement('ide-editor-header');
		
		editor.header = this;
		this.editor = editor;
		this.tags = {};
		
		el.innerHTML = '<div class="close"></div><div class="tags"></div>' +
			'<span class="modified"></span><span class="title"></span>';

		this.$close = el.childNodes[0];
		this.$tags = el.childNodes[1];
		this.$changed = el.childNodes[2];
		this.$title = el.childNodes[3];
		
		editor.el.appendChild(this.el);
		editor.listenTo(this.$close, 'click', this.onClose);
		editor.listenTo(ide.plugins, 'assist', this.render.bind(this));
	}
	
	onClose(ev)
	{
		ev.preventDefault(); ev.stopPropagation();
		this.quit();
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
	
	render()
	{
	var
		e = this.editor,
		title = e.title
	;
		if (this.title!==title)
			this.$title.innerHTML = this.title = title;
	}
	
}
	
class FocusFeature
{
	constructor(editor)
	{
		this.editor = editor;
		editor.focus = this.focus.bind(this);
		editor.focus.blur = this.blur.bind(this);
		editor.listenTo(editor.el, 'click', editor.focus);
	}
	
	blur()
	{
		ide.editor = null;
		this.editor.el.classList.remove('focus');
		ide.plugins.trigger('editor.blur', this.editor);
	}

	/**
	 * Focus editor. Sets ide.editor.
	 */
	focus()
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

class CursorFeature {

	constructor(editor)
	{
		editor.cursor = this;
		this.editor = editor;
	}

}

CursorFeature.commands = {
	'cursor.goUp': function() { this.cursor.goUp(); },
	'cursor.goDown': function() { this.cursor.goDown(); },
	'cursor.goForward': function() { this.cursor.goForward(); },
	'cursor.goBackwards': function() { this.cursor.goBackwards(); },
	'cursor.goStart' : function() { this.cursor.goStart(); },
	'cursor.goEnd' : function() { this.cursor.goEnd(); },
	// TODO remove
	'goLineUp': 'cursor.goUp',
	'goLineDown': 'cursor.goDown'
};
	
class Editor {

	constructor(p)
	{
		this.bindings = [];
		this.plugin = p.plugin;
		this.slot = p.slot || ide.workspace.slot();
		this.el = this.slot.el;
		this.keymap = new ide.KeyMap(this);
		this.command = p.command;
		this.title = p.title || p.command;
		this.features = {};
		
		this.loadFeatures(p);
		
		if (this.initialize)
			this.initialize(p);
		
		this.render(p);
		
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
	
	static feature(name, Feature)
	{
		if (!this.hasOwnProperty('features'))
			this.features = Object.assign({}, this.features);
		
		this.features[name] = Feature;
		
		if (Feature.commands)
			this.registerCommands(Feature.commands);
	}
	
	loadFeatures(p)
	{
		var features = this.constructor.features, i;
		
		for (i in features)
			this.features[i] = new features[i](this, p);
		
		for (i in features)
			if (this.features[i].render)
				this.features[i].render();
	}
	
	/**
	 * Render editor content.
	 */
	render()
	{
		this.$content = document.createElement('ide-editor-content');
		
		this.el.appendChild(this.$content);
	}
	
	getHash()
	{
		var p = this.plugin && this.plugin.name, cmd = this.command || '';
		
		// TODO Verify
		return (p ? p + '.' : '') + cmd + ':';  
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
	
	quit()
	{
		ide.workspace.remove(this);
		ide.plugins.trigger('editor.quit', this);
	}

}
	
Editor.feature('header', EditorHeader);
Editor.feature('focus', FocusFeature);

function _start()
{
	ide.logger = new Logger();
	ide.workspace = new ide.Workspace();
	ide.hash = new ide.Hash();
	ide.project = new ide.Project({
		path: ide.hash.data.p || ide.hash.data.project
	});
	
	ide.project.fetch().then(function() {
		ide.plugins.start();
		ide.keymap.start();
		ide.plugins.ready();
		ide.hash.loadFiles();
	});
	
	ide.searchBar = new ide.Bar.Search();
	ide.commandBar = new ide.Bar.Command();
}
	
Object.assign(ide, {

	/** Used by commands to indicate that the command wasn't handled. */
	Pass: {},
		
	EditorHeader: EditorHeader,
	CursorFeature: CursorFeature,
	FocusFeature: FocusFeature,
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
	open: function(options)
	{
		options.slot = options.slot || ide.workspace.slot();

		function loadEditor(file)
		{
			var editor;
			
			options.file = file;
			
			if (options.plugin)
			{
				editor = options.command ?
					options.plugin.commands[options.command].call(options.plugin, file) :
					options.plugin.open(options);
			} else
				editor = ide.plugins.findPlugin(options);
			
			ide.workspace.add(editor, options.focus);
			
			return editor;
		}

		return options.file ? this.loadFile(options.file).then(loadEditor) :
			Promise.resolve(loadEditor());
	},

	loadFile: function(file)
	{
		return file.content || !file.filename ? Promise.resolve(file) : file.fetch();
	},

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

	if (document.readyState!=='loading')
		window.setTimeout(_start);
	else
		window.addEventListener('DOMContentLoaded', _start);

	window.addEventListener('error', function(msg) {
		ide.error(msg.message);
	});

})(this.cxl);
