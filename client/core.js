/**
 * @license
 *
 */

(function(window, $, cxl) {
"use strict";

var
	_nots,

	ide =
	/** @namespace */
	window.ide = { /** @lends ide */
		
	/** Used by commands to indicate that the command wasn't handled. */
	Pass: {},
		
	version: '0.2.0',

	/** Current opened project */
	project: null,

	/** Current workspace */
	workspace: null,

	/** Current WebSocket */
	socket: null,

	/** Plugin Manager */
	plugins: null,

	/** Asset, script loader */
	loader: null,
		
	win: window,

	/** Displays alert notification on right corner */
	alert: function(message)
	{
		ide.notify(message, 'warn');
	},

	/** Displays error notification on right corner */
	error: function(message)
	{
		ide.notify(message, 'error');
	},

	/**
	 * Get diff between A and B
	 */
	diff: function(A, B)
	{
		var result;
		
		for (var i in B)
			if (B[i] !== A[i])
				(result = result || {})[i] = B[i];
		
		return result;	
	},

	/** Displays notification on right corner */
	notify: function(message, kls)
	{
		kls = kls || 'log';
	var
		span = $('<li><span class="ide-' + kls + '">' + message + '</span></li>')
	;
		span.prependTo(_nots);
		setTimeout(span.remove.bind(span), 3000);
		window.console[kls](message);
	},

	/**
	 * Opens file in new tab
	 */
	open_tab: function(filename, target)
	{
		window.open(
			'#' + ide.workspace.hash.encode({ f: filename || false }),
			target
		);
	},

	/**
	 * Opens a file.
	 * @param filename {ide.File|string} Name of the file relative to project or a File object.
	 * @param options {object|string} If string it will be treated as target
	 * @param options.target Open file in new window.
	 */
	open: function(filename, options)
	{
		ide.plugins.edit(filename || '', options || {});
	},

	/**
	 * Try to execute action in editor or workspace. Actions must return false if
	 * not handled.
	 *
	 * TODO better way of collection result? 
	 */
	action: function(name)
	{
	var
		actions = name.split(' '),
		result, i=0
	;
		for (; i<actions.length; i++)
			result = ide.cmd(actions[i]);
			
		return result;
	}

},
	_start= function()
	{
		ide.workspace = new ide.Workspace();

		_nots = cxl.id('ide-notification');
	}

;
	
ide.Info = cxl.View.extend({ /** @lends ide.Info# */

	/** @type {ide.Editor} */
	editor: null,
	
	visible: false,
	
	_delay: 1500,

	_timeout: null,

	el: '<div class="ide-info"></div>',
	
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

	initialize: function()
	{
		if (!this.slot)
			this.slot = ide.workspace.slot();

		this.setElement(this.slot.el);
		this.listenTo(this.$el, 'click', this._on_click);
		
		this.slot.editor = this;
		this.info = new ide.Info({ editor: this });
		
		this._setup();
		
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
	 * Command Aliases
	 */
	alias: null,

	/**
	 * Handles a single command. Returns false if command wasn't handled. Commands are
	 * editor instance functions. It will ignore methods that start with '_'
	 *
	 * @param name
	 * @param args
	 */
	cmd: function(name, args)
	{
		var fn;
		
		name = this.alias && this.alias[name] || name;

		// TODO see if this makes sense or not.
		if (name[0]!=='_' && this.constructor.prototype.hasOwnProperty(name))
			fn = this[name];
		
		// Make sure info window doesnt interfere with commands.
		// TODO see if we can move this out of here?
		if (this.info.visible)
			this.info.forceHide();

		return typeof(fn)==='function' ? fn.apply(this, args) : ide.Pass;
	},

	_on_click: function()
	{
		if (ide.editor!==this)
			this.focus();
	},

	getInfo: function()
	{
		return (this.file ? this.file.toString() : '') + ' [' + ide.project.get('name') + ']';
	},

	/** Gets the current editor state. Used to persist workspace state in the url hash. */
	state: function()
	{
		return (this.plugin ? this.plugin.name + ':' : '') + 
			(this.file ? this.file.toString() : '');
	},

	focus: function()
	{
		if (ide.editor)
			ide.editor.$el.removeClass('ide-focus');
		
		this.showInfo();

		// TODO move this to workspace?
		ide.editor = this;

		this.$el.addClass('ide-focus');
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
	}

});

	if (document.readyState!=='loading')
		window.setTimeout(_start);
	else
		window.addEventListener('DOMContentLoaded', _start);

})(this, this.jQuery, this.cxl);
