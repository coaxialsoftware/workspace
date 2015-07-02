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

	/** @event write {function(file)} Fires when a file is saved. */
	/** @event beforewrite {function(file)} Fires before a save event. Useful if
		you need access to the file content before modifications.
	*/
		
	version: '0.1.0',

	/** Current opened project */
	project: null,

	/** Current workspace */
	workspace: null,

	/** Current WebSocket */
	socket: null,

	/** Plugin Manager */
	plugins: null,

	/** Information window on left corner */
	info: null,

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
		kls = kls || 'info';
	var
		span = $('<li><span class="ide-' + kls + '">' + message + '</span></li>')
	;
		span.prependTo(_nots);
		setTimeout(span.remove.bind(span), 3000);
		window.console[kls](message);
	},

	/** Displays log message in console only */
	log: function(message)
	{
		window.console.log('[workspace] ' + message);
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

	set_editor: function(editor)
	{
		var info = editor.get_info();

		if (this.editor)
			this.editor.$el.removeClass('ide-focus');

		this.editor = editor;
		window.document.title = info || 'workspace';

		editor.$el.addClass('ide-focus');

		if (info)
			ide.info.show(info);
	},

	Info: cxl.View.extend({ /** @lends ide.Info# */

		_delay: 1500,

		_timeout: null,

		el: '#info',

		hide: function()
		{
			if (this._timeout)
				window.clearTimeout(this._timeout);

			this._timeout = window.setTimeout(
				this.$el.hide.bind(this.$el), this._delay);

			return this;
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
			s.left = s2.left;
			s.width = s2.width;

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
	})

},
	_start= function()
	{
		ide.workspace = new ide.Workspace();
		ide.info = new ide.Info();

		_nots = $('#ide-notification');
	}

;
	/**
	 * Asset/Script Loader
	 * @type Loader
	 */
	ide.loader = new window.Loader();

	ide.Editor = cxl.View.extend({

		constructor: function(p)
		{
			cxl.extend(this, p);

			if (!this.slot)
				this.slot = ide.workspace.slot();

			this.el = this.slot.el;
			this.$el = this.slot.$el
				.on('click', this._on_click.bind(this));
			this.slot.editor = this;

			cxl.View.prototype.constructor.call(this, p);
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

		/**
		 * @abstract
		 * Returns an object { column: 0, row: 0, index: 0 }
		 */
		get_position: function()
		{
			throw "Editor should implement this function";
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
			ide.set_editor(this);
			this.trigger('focus');
		},

		close: function()
		{
			// Remove first so do_layout of workspace works.
			this.remove();
			this.off();
			this.stopListening();
			this.trigger('close', this);
		}

	});

	if (document.readyState!=='loading')
		window.setTimeout(_start);
	else
		window.addEventListener('DOMContentLoaded', _start);

})(this, this.jQuery, this.cxl);
