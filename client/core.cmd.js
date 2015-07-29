
(function(ide) {
"use strict";

var REGEX = /(?:("[^"]+"|[^\s]+)\s*)/g;
//var STRIP_COMMENTS = /((\/\/.*$)|(\/\*[\s\S]*?\*\/))/mg;
//var ARGUMENT_NAMES = /([^\s,]+)/g;
	
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
	
/*function getParamNames(func) {
  var fnStr = func.toString().replace(STRIP_COMMENTS, '');
  return fnStr.slice(fnStr.indexOf('(')+1, fnStr.indexOf(')')).match(ARGUMENT_NAMES);
}*/
	
ide.registerCommand = function(name, def, scope)
{
	if (ide.commands[name])
		window.console.warn('Overriding command "' + name + '"');
	
	if (typeof(def)==='function' && scope)
		def = def.bind(scope);
		//def.args = getParamNames(def);
	
	ide.commands[name] = def;	
};

/** Parse and execute command. */
ide.cmd = function(source)
{
var
	cmd = parse(source),
	result, fn
;
	result = ide.editor ? ide.editor.cmd(cmd.fn, cmd.args) : false;

	if (result===false)
	{
		fn = ide.commands[cmd.fn];

		if (fn)
			result = (typeof(fn)==='string' ? ide.commands[fn] : fn).apply(ide, cmd.args);
	}

	return result;
};

/** @namespace */
ide.commands = {};

})(this.ide);
