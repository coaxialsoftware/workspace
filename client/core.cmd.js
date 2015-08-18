
(function(ide) {
"use strict";
	
var
	CMD_REGEX = /^([^\s]+)\s*(.*)\s*$/
;
	
function parseArguments(args)
{
	var result;
	
	// TODO this is cool, but dangerous?
	try {
		/* jshint evil:true */
		result = (new Function('return ([' + args + ']);'))();
	} catch(e) {
		result = [ args ];
	}
	
	return result;
}
	
ide.parseCommand = function(src)
{
var
	fn = CMD_REGEX.exec(src),
	args
;
	if (fn && fn[1])
	{
		args = fn[2] ? parseArguments(fn[2]) : undefined;
		return { fn: fn[1], args: args };
	}
};

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

function tryCmd(commands, cmd, args)
{
	var fn = commands[cmd];
	
	if (typeof(fn)==='string')
	{
		return ide.cmd(fn, args);
	} else if (fn)
		return fn.apply(ide, args);
	
	return ide.Pass;
}
	
/** Execute command. */
ide.cmd = function(fn, args)
{
var
	result = ide.Pass
;
	if (ide.editor)
	{
		result = ide.editor.cmd(fn, args);
		
		if (result === ide.Pass)
			result = tryCmd(ide.editorCommands, fn, args);
	}

	if (result===ide.Pass)
		result = tryCmd(ide.commands, fn, args);

	return result;
	
};
	
/** @namespace */
ide.commands = {};
ide.editorCommands = {};

})(this.ide);
