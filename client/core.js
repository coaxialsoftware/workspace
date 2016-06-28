/**
 * @license
 *
 */

(function(window, $, cxl, _) {
"use strict";

var
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
		return ide.notify(message, 'warn');
	},

	/** Displays error notification on right corner */
	error: function(message)
	{
		return ide.notify(message, 'error');
	},

	/** Does a POST ajax request. Supports progress events */
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
	 * Opens file in new tab
	 */
	openTab: function(file, target)
	{
		return Promise.resolve(window.open(
			'#' + ide.workspace.hash.encode({ f: file || false }),
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
		if (!options || typeof(options)==='string' || options instanceof ide.File)
			options = { file: options || '' };

		var name, fn='edit', plugin=options.plugin, plugins=this.plugins;

		if (typeof(plugin)==='string')
		{
			// 'plugin.method'
			name = plugin.split('.');
			options.plugin = plugins.get(name[0]);
			if (!options.plugin)
				return ide.error('Plugin not found: ' + name[0]);

			options.fn = fn = name[1] || 'open';
		}

		options.slot = options.slot || ide.workspace.slot();

		function loadEditor(file)
		{
			if (file)
				options.file = file;

			var editor = plugins.findPlugin(options);

			if (editor)
			{
				if (options.focus!==false)
					editor.focus();
				ide.workspace.add(editor);
			} else
				options.slot.$el.remove();
		}

		if (fn==='edit')
			this.loadFile(options.file).then(loadEditor);
		else
			loadEditor();
	},

	loadFile: function(file)
	{
		if (typeof(file)==='string')
			file = ide.fileManager.getFile(file);

		return file.attributes.content ? Promise.resolve(file) :
			new Promise(function(resolve) {
				file.fetch({
					silent: true,
					success: function() {
						delete file.changed;
						resolve(file);
					}
				});
			})
		;
	},

	/** Displays notification on right corner */
	notify: function(message, kls)
	{
	var
		span = message instanceof ide.Item ? message :
			new ide.Notification(message, kls)
	;
		return ide.logger.notify(span);
	}

},
	_start= function()
	{
		// Load Templates
		ide.Item.prototype.template = _.template(cxl.html('tpl-item'));

		ide.logger = new ide.Logger();
		ide.workspace = new ide.Workspace();
		ide.searchBar = new ide.Bar.Search();
		ide.commandBar = new ide.Bar.Command();
	}

;

ide.Logger = function()
{
var
	active = {},
	log = this.items = [],
	el = this.el = cxl.id('notification')
;
	this.delay = 3000;

	this.remove = function(item)
	{
		if (item.id)
			delete(active[item.id]);

		item.remove();
		log.unshift(item);
		if (log.length>100)
			log.length = 100;
	};

	this.notify = function(span)
	{
		if (span.id)
		{
			var old = span.id && active[span.id];

			if (old)
				this.remove(old);

			active[span.id] = span;
		}

		el.insertBefore(span.el, el.firstChild);

		if (span.progress === null || span.progress===1)
			setTimeout(this.remove.bind(this, span), this.delay);

		return span;
	};
};

ide.Editor = cxl.View.extend(/** @lends ide.Editor# */{

	/// Unique ID
	id: null,

	/// Active keymap @type ide.KeyMap
	keymap: null,

	/// Workspace slot @required
	slot: null,

	/// @private
	load: function()
	{
		this.id = editorId++;
		this.slot = this.slot || ide.workspace.slot();
		this.setElement(this.slot.el);
		this.listenTo(this.$el, 'click', this.focus);

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

	/**
	 * Handles a single command. Returns false if command wasn't handled. Commands are
	 * editor instance functions.
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

	getInfo: function()
	{
	var
		project = ide.project.get('name') || ide.project.id,
		plugin = this.plugin && this.plugin.name || this.plugin
	;
		return (this.changed && this.changed() ? '+ ' : '') +
			((this.file instanceof ide.File ?
			  this.file.get('filename') :
			  plugin + ':' + this.file) || 'No Name') +
			(project ? ' [' + project + ']' : '');
	},

	/**
	 * Focus editor. Sets ide.editor.
	 */
	focus: function()
	{
		if (ide.editor === this)
			return;

		if (ide.editor)
			ide.editor.$el.removeClass('focus');

		// TODO move this to workspace?
		ide.editor = this;

		this.$el.addClass('focus');
		ide.plugins.trigger('editor.focus', this);
	},

	/** @private */
	_close: function(force)
	{
		if (!force && this.changed && this.changed())
			return "File has changed. Are you sure?";

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
		return this.file.originalValue !== this.file.attributes.content;
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
		file.save();
	},

	onFileChanged: function()
	{
		this.setValue(this.file.attributes.content);
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
