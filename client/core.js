/**
 * @license
 *
 */

(function(window, $, cxl, _) {
"use strict";
	
var
	_nots,
	editorId = 1,

	ide =
	/** @namespace */
	window.ide = { /** @lends ide */
		
	/** Used by commands to indicate that the command wasn't handled. */
	Pass: {},
		
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
		ide.notify(message, 'warn');
	},

	/** Displays error notification on right corner */
	error: function(message)
	{
		ide.notify(message, 'error');
	},

	/** Displays notification on right corner */
	notify: function(message, kls)
	{
		kls = kls || 'log';
	var
		span = message instanceof ide.Item ? message : 
			new ide.Item({ title: message, className: kls })
	;
		setTimeout(span.remove.bind(span), 3000);
		_nots.insertBefore(span.el, _nots.firstChild);
	},
		
	source: function(src)
	{
		/* jshint evil:true */
		return (new Function(src)).call(window);
	},

	/**
	 * Opens a file.
	 * @param options {object|string} If string it will be treated as target
	 * @param options.file {ide.File|string} Name of the file relative to project or a File object.
	 * @param options.target Open file in new window.
	 * @param options.plugin Specify what plugin to use.
	 */
	open: function(options)
	{
		if (!options || typeof(options)==='string' || options instanceof ide.File)
			options = { file: options };
		
		if (options.target)
			return window.open(
				'#' + ide.workspace.hash.encode({ f: options.file || false }),
				options.target || '_blank'
			);
		
		if (typeof(options.plugin)==='string')
			options.plugin = ide.plugins.get(options.plugin);
		
		if (!(options.plugin && options.plugin.open &&
			!options.plugin.edit) && typeof(options.file)==='string')
			options.file = ide.fileManager.getFile(options.file);
		
		ide.plugins.edit(options);
	},

	/**
	 * Try to execute action in editor or workspace. Actions must return false if
	 * not handled.
	 *
	 * TODO better way of collection result? Merge with run. 
	 */
	action: function(name)
	{
	var
		actions = name.split(' '),
		result, i=0
	;
		for (; i<actions.length; i++)
			result = ide.run(actions[i]);
			
		return result;
	}

},
	_start= function()
	{
		// Load Templates
		ide.Item.prototype.template = cxl._templateId('tpl-item');
		ide.Editor.List.prototype.template = cxl.templateId('tpl-editor-list');
		
		ide.workspace = new ide.Workspace();
		ide.searchBar = new ide.Bar.Search();
		ide.commandBar = new ide.Bar.Command();

		ide.$notifications = _nots = cxl.id('notification');
	}

;
	
ide.Info = cxl.View.extend({ /** @lends ide.Info# */

	/** @type {ide.Editor} */
	editor: null,
	
	visible: false,
	
	_delay: 1500,

	_timeout: null,

	el: '<div class="info"></div>',
	
	initialize: function()
	{
		this.editor.el.appendChild(this.el);
	},
	
	forceHide: function()
	{
		this.$el.hide();
		this.visible = this._timeout = false;
	},

	hide: function()
	{
		var me = this;
		
		if (this._timeout)
			return;

		me._timeout = window.setTimeout(function() {
			me.$el.css('opacity', 0);
			window.setTimeout(me.forceHide.bind(me), 250);
		}, me._delay);
	},

	do_show: function(msg)
	{
	var
		s = this.el.style,
		el = this.editor.el,
		s2 = el.style,
		cursor = this.editor.get_cursor && this.editor.get_cursor()
	;
		this.visible = true;
		
		if (cursor && cursor.offsetTop > 20)
		{
			s.top = s2.top;
			s.bottom = '';
		} else
		{
			s.top = '';
			s.bottom = 0;
		}

		this.$el.html(msg).css('opacity', 1).css('display', 'block');
		return this.hide();
	},

	show: function(msg)
	{
		if (msg)
			window.setTimeout(this.do_show.bind(this, msg));
	}
});

ide.Editor = cxl.View.extend({
	
	/* Executes after template has been loaded */
	_ready: null,
	
	/// Unique ID
	id: null,

	load: function()
	{
		this.id = editorId++;
		
		if (!this.slot)
			this.slot = ide.workspace.slot();

		this.setElement(this.slot.el);
		this.listenTo(this.$el, 'click', this.onClick);
		
		this._setup();
		
		if (this.template)
			this.loadTemplate(this.template);
		
		this.info = new ide.Info({ editor: this });
		
		if (this._ready)
			this._ready();
		
		ide.plugins.trigger('editor.load', this);
	},
	
	/** Plugin that instantiated the editor @required */
	plugin: null,

	/**
	 * File that is being edited or command to restore state.
	 * @required
	 */
	file: null,
	
	/**
	 * Handles a single command. Returns false if command wasn't handled. Commands are
	 * editor instance functions. It will ignore methods that start with '_'
	 *
	 * @param name
	 * @param args
	 */
	cmd: function(name, args)
	{
		var fn = this.commands[name];
		
		if (typeof(fn)==='string')
			return this.cmd(fn, args);
		
		// Make sure info window doesnt interfere with commands.
		// TODO see if we can move this out of here?
		if (this.info.visible)
			this.info.forceHide();

		return fn ? fn.apply(this, args) : ide.Pass;
	},

	onClick: function()
	{
		if (ide.editor!==this)
			this.focus();
	},

	getInfo: function()
	{
		return (this.changed && this.changed() ? '+ ' : '') +
			((this.file instanceof ide.File ? this.file.get('filename') : this.file) || 'No Name') +
			' [' + (ide.project.get('name') || ide.project.id) + ']';
	},

	focus: function()
	{
		if (ide.editor)
			ide.editor.$el.removeClass('focus');
		
		this.showInfo();

		// TODO move this to workspace?
		ide.editor = this;

		this.$el.addClass('focus');
		ide.plugins.trigger('editor.focus', this);
	},
	
	showInfo: function()
	{
		var info = this.getInfo();
		
		window.document.title = info || 'workspace';
		
		if (info)
			this.info.show(info);
	},	

	_close: function(force)
	{
		if (!force && this.changed && this.changed())
			return "File has changed. Are you sure?";
		// Remove first so do_layout of workspace works.
		this.remove();
	},
	
	setKeymapState: function(state)
	{
		if (typeof(this.keymap)==='object')
			this.keymap.state = state;
		else
			this.keymap = state;
		
		ide.plugins.trigger('editor.keymap', this, state);
	}

}, {
	
	extend: function(def, st)
	{
		var result = cxl.View.extend.call(this, def, st);
		
		if (def.commands)
		{
			for (var i in def.commands)
				result.prototype[i] = def.commands[i];
			
			if (this.prototype.commands)
				result.prototype.commands = _.create(this.prototype.commands, def.commands);
		}
		
		result.extend = ide.Editor.extend;
		return result;
	}
	
});

	if (document.readyState!=='loading')
		window.setTimeout(_start);
	else
		window.addEventListener('DOMContentLoaded', _start);

})(this, this.jQuery, this.cxl, this._);
