
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
	if (fn)
	{
		if (typeof(fn)==='string')
			fn = ide.commands[fn];
	} else if (ide.editor)
	{
		fn = ide.editor.cmd && ide.editor.cmd(cmd[0]);
		scope = ide.editor;
	}

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
	var cmd = parse(source), result;

	if (!cmd.fn)
	{
		/*jshint -W054 */
		try {
			result = (new Function("with(ide) { " + source + "}"))();
			if (result !== undefined)
				ide.notify(result);
		} catch(e)
		{
			ide.alert('Unknown Command: ' + source);
			window.console.log(e);
		}
	}
	else
		cmd.fn.apply(cmd.scope, cmd.args);

	return this;
};

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
		window.open('#' + ide.workspace.hash.encode({ p: name, f: null }));
	},

	wq: function()
	{
		ide.cmd('w').cmd('q');
	}

};

})(this.ide);
