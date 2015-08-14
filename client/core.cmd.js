
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
	if (name in ide.commands)
		window.console.warn('Overriding command "' + name + '"');
	
	if (typeof(def)==='function' && scope)
		def = def.bind(scope);
		//def.args = getParamNames(def);
	
	ide.commands[name] = def;	
};
	
/**
 * Registers a command that only gets executed if an editor is active
 */
ide.registerEditorCommand = function(name, def, scope)
{
	if (name in ide.editorCommands)
		window.console.warn('Overriding editor command "' + name + '"');
	
	if (typeof(def)==='function' && scope)
		def = def.bind(scope);
	
	ide.editorCommands[name] = def;
};

function tryCmd(commands, cmd)
{
	var fn = commands[cmd.fn];
	
	if (typeof(fn)==='string')
	{
		cmd.fn = fn;
		return exec(cmd);
	} else if (fn)
		return fn.apply(ide, cmd.args);
	
	return ide.Pass;
}
	
function exec(cmd)
{
var
	result
;
	if (ide.editor)
	{
		result = ide.editor.cmd(cmd.fn, cmd.args);
		
		if (result === ide.Pass)
			result = tryCmd(ide.editorCommands, cmd);
	}

	if (result===ide.Pass)
		result = tryCmd(ide.commands, cmd);

	return result;
}

/** Parse and execute command. */
ide.cmd = function(source)
{
	return exec(parse(source));
};

/** @namespace */
ide.commands = {};
ide.editorCommands = {};

})(this.ide);
