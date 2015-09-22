
(function(ide, cxl, _) {
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
		
		state.i = pos.index + (pos[1] ? pos[1].length : 0);
		
		result = args.slice(i, state.i);
		
		try {
			state.result.push(fn ? fn(result) : result);
		} catch (e)
		{
			this.error(state, e.message);
		}
	},
	
	parseString: function(args, state)
	{
		this.parseUntil(args, state, /([^\\]")/g, JSON.parse);
	},
	
	parseRegex: function(args, state)
	{
		this.parseUntil(args, state, /([^\\]\/[gimy]*)/g, ide.sandbox);
	},
	
	parseJS: function(args, state)
	{
		state.i++;
		this.parseUntil(args, state, /([^\\])`/g, ide.sandbox);
		state.i++;
	},
	
	parsePath: function(args, state)
	{
		this.parseUntil(args, state, /[^\\](\s)|$/g, function(a) {
			return a.replace(/\\ /g, ' '); });
	},
	
	parseCmd: function(args, state)
	{
		this.parseUntil(args, state, /\s|$/g, null);
		this.ignoreSpace(args, state);
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
			
			state.i++;
			state.result = [];
			this.ignoreSpace(src, state);
			commands.push(current);
		} while(state.i < state.end);
		
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
	{
		ide.workspace.add(result);
		result.focus();
	}

	return result;
};
	
/** @namespace */
ide.commands = {};
ide.editorCommands = {};
	
ide.plugins.register('cmd', {
	
	commands: {
		commands: function()
		{
			return this.open({ plugin: this, params: 'commands' });
		}
	},
	
	loadCommands: function(e)
	{
		e.reset();
		
		var result = [];
		
		function getCommands(cmds, tag)
		{
			var tags;
			
			for (var i in cmds)
			{
				tags = tag ? [ tag ] : [];
				
				if (typeof(cmds[i])==='string')
					tags.push('alias:' + cmds[i]);
					
				result.push({ title: i, className: 'cmd', tags: tags });
			}
		}
		
		getCommands(ide.commands);
		getCommands(ide.editorCommands, 'editor');
		getCommands(ide.editor.commands, 'editor');
		
		e.add(_.sortBy(result, 'title'));
	},
	
	open: function(options)
	{
		options.title = 'commands';
		var editor = new ide.Editor.List(options);
		editor.listenTo(ide.plugins, 'editor.focus', this.loadCommands.bind(this, editor));
		return editor;
	}
	
});

})(this.ide, this.cxl, this._);
