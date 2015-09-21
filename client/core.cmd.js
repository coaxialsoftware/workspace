
(function(ide, cxl) {
"use strict";
	
ide.Feature = function Feature(p)
{
	cxl.extend(this, p);
};

ide.sandbox = function(a) {
	/* jshint evil:true */
	return (new Function(
		'var window, document;' +
		'return (' + a + ');'
	)).call(undefined);
};
	
function CommandParser()
{
}
	
cxl.extend(CommandParser.prototype, {
	
	error: function(state, msg)
	{
		throw new Error("Column " + state.i + ': ' + msg);
	},
	
	parseUntil: function(args, state, end, fn)
	{
		end.lastIndex = state.i;
		var pos = end.exec(args), i = state.i, result;
		
		if (!pos)
			this.error(state, "Unexpected end of line.");
		
		state.i = pos.index + pos[0].length;
		
		result = args.slice(i, state.i);
		
		state.result.push(fn ? fn(result) : result);
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
	
	parseCmd: function(args, state)
	{
		this.parseUntil(args, state, /\s+|$/g);
		return state.result[0];
	},
	
	ignoreSpace: function(args, state)
	{
		while (/\s/.test(args[state.i]))
			state.i++;
	},
	
	parseArguments: function(args, state)
	{
		state.result = [];
		
		while ((state.i < state.end) && args[state.i] !== ';')
		{
			switch(args[state.i]) {
			case '"': this.parseString(args, state); break;
			case '/': this.parseRegex(args, state); break;
			case '`': this.parseJS(args, state); break;
			default: this.parsePath(args, state); break;
			}
			
			this.ignoreSpace(args, state);
		}
			
		return state.result.length ? state.result : null;
	},
	
	parse: function(src)
	{
	var
		state = { i: 0, result: [], end: src.length },
		commands = [], current
	;
		do {
			current = {
				fn: this.parseCmd(src, state),
				args: this.parseArguments(src, state)
			};
			
			commands.push(current);
		} while(state.i !== state.end);
		
		return commands.length>1 ? commands : commands[0];
	},
	
	/** Parses and executes command. */
	run: function(src)
	{
		var cmd = this.parse(src);
		return ide.run(cmd.fn, cmd.args);
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
		return ide.run(fn, args);
	} else if (fn)
		return fn.apply(ide, args);
	
	return ide.Pass;
}
	
function runArray(cmds)
{
	var result;
	
	cmds.forEach(function(cmd) {
		result = ide.run(cmd.fn, cmd.args);
	});
	
	return result;
}
	
/** Execute command. */
ide.run = function(fn, args)
{
	if (Array.isArray(fn))
		return runArray(fn);
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
	
	if (result instanceof ide.Editor)
		ide.workspace.add(result);

	return result;
};
	
/** @namespace */
ide.commands = {};
ide.editorCommands = {};

})(this.ide, this.cxl);
