
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
	name = cmd[0]
;
	cmd.shift();

	return {
		fn: name,
		args: cmd
	};
}
	
ide.registerCommand = function(name, def, scope)
{
	if (ide.commands[name])
		window.console.warn('Overriding command "' + name + '"');
	
	if (typeof(def)==='function' && scope)
		def = def.bind(scope);
		//def.args = getParamNames(def);
	
	ide.commands[name] = def;	
};
	
function exec(cmd)
{
var
	result, fn
;
	result = ide.editor ? ide.editor.cmd(cmd.fn, cmd.args) : ide.Pass;

	if (result===ide.Pass)
	{
		fn = ide.commands[cmd.fn];

		if (typeof(fn)==='string')
		{
			cmd.fn = fn;
			return exec(cmd);
		} else if (fn)
			result = fn.apply(ide, cmd.args);
	}

	return result;
}

/** Parse and execute command. */
ide.cmd = function(source)
{
	return exec(parse(source));
};

/** @namespace */
ide.commands = {};

})(this.ide);
