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
		
	version: '0.1.0',

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
	
	_delay: 1500,

	_timeout: null,

	el: '<div class="ide-info"></div>',
	
	initialize: function()
	{
		this.editor.el.appendChild(this.el);
	},

	hide: function()
	{
		var me = this;
		
		if (this._timeout)
			window.clearTimeout(this._timeout);

		me._timeout = window.setTimeout(function() {
			me.$el.css('opacity', 0);
			window.setTimeout(me.$el.hide.bind(me.$el), 250);
		}, me._delay);
	},

	do_show: function(msg)
	{
		if (!ide.editor)
			return;

	var
		s = this.el.style,
		el = ide.editor.el,
		s2 = el.style,
		cursor = ide.editor.get_cursor && ide.editor.get_cursor()
	;
		if (cursor && cursor.offsetTop > 20)
		{
			s.top = s2.top;
			s.bottom = '';
		} else
		{
			s.top = '';
			s.bottom = (window.innerHeight - el.offsetTop - el.offsetHeight) + 'px';
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
		this.$el.on('click', this._on_click.bind(this));
		
		this.slot.editor = this;
		this.info = new ide.Info({ editor: this });

		this.setup();
	},

	/** Plugin that instantiated the editor @required */
	plugin: null,

	/**
	 * File that is being edited or command to restore state.
	 * @required
	 */
	file: null,

	/**
	 * Handles commands
	 * @type {Function}
	 */
	cmd: null,

	_on_click: function()
	{
		if (ide.editor!==this)
			this.focus();
	},

	get_info: function()
	{
		return this.file.toString() + ' [' + ide.project.get('name') + ']';
	},

	/** Gets the current editor state. Used to persist workspace state in the url hash. */
	state: function()
	{
		return this.plugin.name + ':' + this.file.toString();
	},

	focus: function()
	{
		var info = this.get_info();

		if (ide.editor)
			ide.editor.$el.removeClass('ide-focus');

		// TODO move this to workspace?
		ide.editor = this;
		window.document.title = info || 'workspace';

		this.$el.addClass('ide-focus');

		if (info)
			this.info.show(info);
		
		this.trigger('focus');
	},

	close: function()
	{
		// Remove first so do_layout of workspace works.
		this.remove();
		this.trigger('close', this);
	}

});

	if (document.readyState!=='loading')
		window.setTimeout(_start);
	else
		window.addEventListener('DOMContentLoaded', _start);

})(this, this.jQuery, this.cxl);
