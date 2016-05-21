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

	// We store the last 100 notifications.
	log: [],

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

	/** Displays notification on right corner */
	notify: function(message, kls)
	{
	var
		log = ide.log,
		span = message instanceof ide.Item ? message :
			new ide.Notification(message, kls)
	;
		_nots.insertBefore(span.el, _nots.firstChild);

		log.unshift(span);
		if (log.length>100)
			ide.log = log.slice(0, 100);

		return span;
	},

	post: function(url, payload, onprogress)
	{
		return $.ajax({
			url: url,
			data: JSON.stringify(payload),
			contentType: 'application/json',
			type: 'POST',
			xhr: /* istanbul ignore next */ function()
			{
				var xhr = $.ajaxSettings.xhr();
				if (onprogress)
					xhr.addEventListener('progress', onprogress);
				return xhr;
			}
		}).fail(function(xhr) {
			ide.error(xhr.responseText || 'Unknown server error.');
		});
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
	 * @return Returns a Jquery Deferred.
	 */
	open: function(options)
	{
		var result = $.Deferred();

		if (!options || typeof(options)==='string' || options instanceof ide.File)
			options = { file: options || '' };

		if (options.target)
			return result.resolve(window.open(
				'#' + ide.workspace.hash.encode({ f: options.file || false }),
				options.target
			));

		if (typeof(options.plugin)==='string')
			options.plugin = ide.plugins.get(options.plugin);

		if (!(options.plugin && options.plugin.open &&
			!options.plugin.edit) && typeof(options.file)==='string')
			options.file = ide.fileManager.getFile(options.file);

		return ide.plugins.edit(options, result);
	}

},
	_start= function()
	{
		// Load Templates
		ide.Item.prototype.template = _.template(cxl.html('tpl-item'));

		ide.workspace = new ide.Workspace();
		ide.searchBar = new ide.Bar.Search();
		ide.commandBar = new ide.Bar.Command();

		ide.$notifications = _nots = cxl.id('notification');
	}

;
	
ide.Editor = cxl.View.extend({

	/// Unique ID
	id: null,

	/// Active keymap @type ide.KeyMap
	keymap: null,

	load: function()
	{
		this.id = editorId++;

		if (!this.slot)
			this.slot = ide.workspace.slot();

		this.setElement(this.slot.el);
		this.listenTo(this.$el, 'click', this.onClick);

		this.keymap = new ide.KeyMap();

		cxl.View.prototype.load.call(this, this.$el);

		ide.plugins.trigger('editor.load', this);
	},

	/** @abstract */
	option: function() {},

	/** Plugin that instantiated the editor @required */
	plugin: null,

	/**
	 * File that is being edited or command to restore state.
	 * @required
	 */
	file: null,

	/** @type {Function} */
	changed: null,

	/** @type {Function} */
	save: null,

	/**
	 * Handles a single command. Returns false if command wasn't handled. Commands are
	 * editor instance functions. It will ignore methods that start with '_'
	 *
	 * @param name
	 * @param args
	 */
	cmd: function(name, args)
	{
		var fn = this.commands && this.commands[name];

		if (typeof(fn)==='string')
			return this.cmd(fn, args);

		return fn ? fn.apply(this, args) : ide.Pass;
	},

	onClick: function()
	{
		if (ide.editor!==this)
			this.focus();
	},

	getInfo: function()
	{
		var project = ide.project.get('name') || ide.project.id;

		return (this.changed && this.changed() ? '+ ' : '') +
			((this.file instanceof ide.File ?
			  this.file.get('filename') :
			  this.plugin.name + ':' + this.file) || 'No Name') +
			(project ? ' [' + project + ']' : '');
	},

	focus: function()
	{
		if (ide.editor === this)
			return;

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

		if (!ide.assist.visible)
			ide.notify(info);
	},

	_close: function(force)
	{
		if (!force && this.changed && this.changed())
			return "File has changed. Are you sure?";
		// Remove first so do_layout of workspace works.
		this.remove();
	},

	remove: function()
	{
		this.$el.remove();
		this.unbind();
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

/** Editor with ide.File support */
ide.Editor.File = ide.Editor.extend({

	/** @type {ide.File} */
	file: null,

	changed: function()
	{
		return this.file.hasChanged('content');
	},

	setValue: function(value)
	{
		this.file.set('content', value);
	},

	getValue: function()
	{
		return this.file.get('content');
	},

	write: function(file)
	{
		var value = this.getValue();

		if (this.file !== file)
			this.setFile(file);

		file.set('content', value);
		file.once('write', this.showInfo, this);
		file.save();
	},

	onFileChanged: function()
	{
		var content = this.file.get('content');

		if (this.getValue() !== content)
			this.setValue(content);
	},

	load: function()
	{
		this.setFile(this.file);
		ide.Editor.prototype.load.apply(this, arguments);
	},

	setFile: function(file)
	{
		this.file = file;
		this.stopListening(this.file);
		this.listenTo(file, 'change:content', this.onFileChanged);
	}

});

	if (document.readyState!=='loading')
		window.setTimeout(_start);
	else
		window.addEventListener('DOMContentLoaded', _start);

	window.addEventListener('error', function(msg) {
		ide.error(msg.message);
	});

})(this, this.jQuery, this.cxl, this._);
