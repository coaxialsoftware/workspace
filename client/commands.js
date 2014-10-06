
(function(ide) {
"use strict";

function scan(text)
{
	return text.split(' ');
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
	var cmd = parse(source);

	if (!cmd.fn)
		ide.alert('Unknown Command: ' + source);
	else
		cmd.fn.apply(cmd.scope, cmd.args);

	return this;
};

ide.commands = {

	edit: function()
	{
		if (arguments.length)
			for (var i=0; i<arguments.length; i++)
				ide.open(arguments[i]);
		else
			ide.open();
	},

	e: 'edit',

	"q!": function()
	{
		if (ide.editor)
			ide.workspace.remove(ide.editor, true);
	},

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
		ide.open(name, '_blank');
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
