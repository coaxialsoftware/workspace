
(function(ide) {
"use strict";

var REGEX = /(?:("[^"]+"|[^\s]+)\s*)/g;

function scan(text)
{
	var m, result = [];

	while ((m = REGEX.exec(text)))
		result.push(m[1]);

	return result;
}

function parse(text)
{
var
	cmd = scan(text),
	fn = ide.commands[cmd[0]],
	scope = ide
;
	if (!fn && ide.editor)
	{
		// Try editor.cmd function first then command list if
		// present.
		fn = (ide.editor.cmd && ide.editor.cmd(cmd[0])) ||
			(ide.editor.commands && ide.editor.commands[cmd[0]]);
		scope = ide.editor;
	}
	
	if (typeof(fn)==='string')
		fn = scope.commands[fn];

	cmd.shift();

	return {
		fn: fn,
		args: cmd,
		scope: scope
	};
}

/** Parse and execute command. */
ide.cmd = function(source)
{
	var cmd = parse(source);

	if (!cmd.fn)
		ide.alert('Unknown Command: ' + source);
	else
		cmd.fn.apply(cmd.scope, cmd.args);

	return this;
};

/** @namespace */
ide.commands = {

	/**
		Edits file with registered plugins.
		@param {string} ... Files to open.
	*/
	edit: function()
	{
		if (arguments.length)
			for (var i=0; i<arguments.length; i++)
				ide.open(arguments[i]);
		else
			ide.open();
	},

	e: 'edit',

	/// Quit always, without writing.
	"q!": function()
	{
		if (ide.editor)
			ide.workspace.remove(ide.editor, true);
	},

	/// Quit Vim. This fails when changes have been made.
	q: function()
	{
		if (ide.editor)
			ide.workspace.remove(ide.editor);
		else
			window.close();
	},

	qa: function()
	{
		ide.workspace.close_all();
	},

	help: function(topic)
	{
		window.open('/docs/index.html#' + (topic || ''));
	},

	tabe: function(name)
	{
		ide.open_tab(name, '_blank');
	},

	project: function(name)
	{
		window.open('#' + ide.workspace.hash.encode({ p: name || null, f: null }));
	},

	wq: function()
	{
		ide.cmd('w').cmd('q');
	}

};

})(this.ide);
