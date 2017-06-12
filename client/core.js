/**
 * @license
 *
 */

(function(cxl) {
"use strict";

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

var ide = window.ide = {

	/** Used by commands to indicate that the command wasn't handled. */
	Pass: {},

	resources: ResourceManager,

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
			new ide.Notification(message, kls)
	;
		return ide.logger.notify(span);
	}

};

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

function _start()
{
	cxl.dom.root = new cxl.dom.Element(document.body);

	ide.logger = new ide.Logger();
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

if (document.readyState!=='loading')
	window.setTimeout(_start);
else
	window.addEventListener('DOMContentLoaded', _start);

window.addEventListener('error', function(msg) {
	ide.error(msg.message);
});

})(this.cxl);
