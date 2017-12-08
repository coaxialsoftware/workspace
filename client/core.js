/**
 * @license
 *
 */

(function(cxl) {
"use strict";

var ResourceManager;

class Resource
{
	constructor(id, element)
	{
		this.id = id;
		this.element = element;
	}

	destroy()
	{
		delete ResourceManager.$icons[this.id];
	}
}

ResourceManager = {

	$icons: {},

	getIcon: function(id)
	{
		var r = this.$icons[id];

		if (!r)
			throw new Error('Invalid Icon');

		return r.cloneNode(true);
	},

	registerIcon: function(id)
	{
		var el = this.$icons[id] = document.createElement('ide-icon');
		el.className = id;

		return new Resource(id, el);
	},

	registerSVGIcon: function(id, content, viewbox)
	{
		// tagName must remain lowercase or it wont load the element
		var svg = this.$icons[id] = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
		svg.innerHTML = content;
		svg.setAttribute('class', 'ide-icon');
		svg.setAttribute('viewBox', viewbox);
		return new Resource(id, svg);
	}

};

[ 'bug','command','cog','directory','error','file','git','keyword','property','project',
	'settings', 'tag', 'variable', 'variable-global', 'value', 'expand', 'collapse'
].forEach(icon => ResourceManager.registerIcon(icon));

var ide = window.ide = {

	version: '2.7.0',
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
		return ide.notify(message.toString(), 'error');
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

	confirm: cxl.ui.confirm.bind(cxl.ui),

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
	return file.content || !file.name ? Promise.resolve(file) : file.read();
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

	options.slot.attach(editor);

	if (options.focus!==false)
		ide.workspace.focusEditor(editor);

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
	if (typeof(options) ==='string')
		options = { file: new ide.File(options) };
	else if (options instanceof ide.File)
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
