
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
ide.commands = {};

})(this.ide);
