
(function(ide, cxl) {
"use strict";
	
ide.sandbox = function(a) {
	/* jshint evil:true */
	return (new Function(
		'var window, document;' +
		'return (' + a + ');'
	)).call(undefined);
};
	
function CommandParser()
{
	this.CMD_REGEX = /^([^\s]+)\s*(.*)\s*$/;
}
	
cxl.extend(CommandParser.prototype, {
	
	error: function(state, msg)
	{
		throw new Error("Column " + state.i + ': ' + msg);
	},
	
	parseUntil: function(args, state, end, fn)
	{
		end.lastIndex = state.i;
		var pos = end.exec(args), i = state.i;
		
		if (!pos)
			this.error(state, "Unexpected end of line.");
		
		state.i = pos.index + pos[0].length;
		
		if (fn)
			state.result.push(fn(args.slice(i, state.i)));
	},
	
	parseString: function(args, state)
	{
		this.parseUntil(args, state, /[^\\]"/g, JSON.parse);
	},
	
	parseRegex: function(args, state)
	{
		this.parseUntil(args, state, /[^\\]\/\w*/g, ide.sandbox);
	},
	
	parseJS: function(args, state)
	{
		this.parseUntil(args, state, /[^\\]`/g, ide.sandbox);
	},
	
	parsePath: function(args, state)
	{
		this.parseUntil(args, state, /[^\\] |$/g, function(a) {
			return a.trim().replace(/\\ /g, ' '); });
	},
	
	parseArguments: function(args)
	{
		var state = { i: 0, result: [], end: args.length };

		do {
			switch(args[state.i]) {
			case '"': this.parseString(args, state); break;
			case '/': this.parseRegex(args, state); break;
			case '`': this.parseJS(args, state); break;
			default: this.parsePath(args, state); break;
			}
			
			while (/\s/.test(args[state.i]))
				state.i++;
			
		} while (state.i !== state.end);

		return state.result;
	},
	
	parse: function(src)
	{
	var
		fn = this.CMD_REGEX.exec(src),
		args
	;
		if (fn && fn[1])
		{
			args = fn[2] ? this.parseArguments(fn[2]) : undefined;
			return { fn: fn[1], args: args };
		}
	},
	
	/** Parses and executes command. */
	run: function(src)
	{
		var cmd = this.parse(src);
		return ide.cmd(cmd.fn, cmd.args);
	}
	
});

ide.commandParser = new CommandParser();

ide.registerCommand = function(name, def, scope)
{
	if (name in ide.commands)
		window.console.warn('Overriding command "' + name + '"');
	
	if (typeof(def)==='function' && scope)
		def = def.bind(scope);
	
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

})(this.ide, this.cxl);
