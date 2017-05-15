
(function(ide, cxl) {
"use strict";

function sandbox(a) {
	/* jshint evil:true */
	return (new Function(
		'var window, document, editor=ide.editor,' +
		'token=editor && editor.token,' +
		'selection = editor && editor.selection' +
		';return (' + a + ');'
	)).call(undefined);
}

function CommandParser() {}

cxl.extend(CommandParser.prototype, {

	error: function(state, msg)
	{
		if (!state.silent)
			throw new Error("Column " + state.i + ': ' + msg);
	},

	parseUntil: function(args, state, end, fn)
	{
		end.lastIndex = state.i;
		var pos = end.exec(args), i = state.i, result;

		if (!pos)
		{
			this.error(state, "Unexpected end of line.");
			pos = { index: state.i, '1': args.substr(state.i) };
		}

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
		this.parseUntil(args, state, /([^\\]\/[gimy]*)/g, sandbox);
	},

	parseJS: function(args, state)
	{
		state.i++;
		this.parseUntil(args, state, /([^\\])`/g, sandbox);
		state.i++;
	},

	parsePath: function(args, state)
	{
		this.parseUntil(args, state, /[^\\]([\s;])|$/g, function(a) {
			return a.replace(/\\ /g, ' ');
		});
	},

	parseCmd: function(args, state)
	{
		this.parseUntil(args, state, /[\s;]|$/g, null);
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

	parse: function(src, silent)
	{
	var
		state = { i: 0, result: [], end: src.length, silent: silent },
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

		return commands;
	},

	/** Parses and executes command. */
	run: function(src)
	{
		var cmd = this.parse(src);
		return ide.runParsedCommand(cmd);
	}

});

ide.commandParser = new CommandParser();

function tryCmd(commands, cmd, args)
{
	var fn = commands[cmd];

	if (!fn)
		return ide.Pass;

	return typeof(fn)==='string' ? ide.run(fn, args) : fn.apply(null, args);
}

/** Execute single command. */
ide.run = function(fn, args)
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

	if (result instanceof ide.Editor)
	{
		// TODO ?
		if (!result.command)
			result.command = fn;
		if (!result.arguments)
			result.arguments = args;

		ide.workspace.slot().setEditor(result);
		result.focus.set();
	}

	return result;
};

ide.runParsedCommand = function(cmds)
{
	var result, i=0, l=cmds.length, cmd;

	for (;i<l; i++)
	{
		cmd = cmds[i];
		result = ide.run(cmd.fn, cmd.args);

		if (result===ide.Pass)
			break;
	}

	return result;
};

ide.findCommand = function(name)
{
	function getCommands(cmds)
	{
		for (var i in cmds)
		{
			if (i !== name)
				continue;

			return cmds[i];
		}
	}

	return getCommands(ide.commands) || (ide.editor &&
		(getCommands(ide.editorCommands) || getCommands(ide.editor.constructor.commands)));
};

/** @namespace */
ide.commands = {};
ide.editorCommands = {};

function addCmd(prop, name, def, scope)
{
	if (name in prop)
		window.console.warn('Overriding command "' + name + '"');

	prop[name] = new ide.Command(name, def, scope);
}

ide.registerCommand = addCmd.bind(this, ide.commands);

/**
 * Registers a command that only gets executed if an editor is active
 */
ide.registerEditorCommand = addCmd.bind(this, ide.editorCommands);

ide.plugins.register('cmd', {

	commands: {
		commands: {
			fn: function()
			{
				var editor = new ide.ListEditor({
					command: 'commands', plugin: this
				});

				editor.listenTo(ide.plugins, 'editor.focus', this.loadCommands.bind(this, editor));

				return editor;
			},
			description: 'Show commands for active editor'
		},

		keymap: function()
		{
			var editor = new ide.ListEditor({
				command: 'keymap', plugin: this
			});

			editor.listenTo(ide.plugins, 'editor.focus', this.loadKeymap.bind(this, editor));
			editor.listenTo(ide.plugins, 'editor.keymap', this.loadKeymap.bind(this, editor));

			return editor;
		},

		log: function()
		{
			return new ide.ListEditor({
				children: ide.logger.items,
				plugin: this, command: 'log'
			});
		}
	},

	onAssistInline: function(done, editor, token)
	{
		var hints;

		if (token.type==='command' && token.value)
			hints = this.getAllCommands(token.value);

		if (hints)
			done(hints);
	},

	getCommand: function(name)
	{
		return ide.commands[name];
	},

	getFiles: function(str)
	{
	var
		hints = [],
		files = ide.project.get('files'), i, total=0, f
	;
		if (!files)
			return;

		for (i=0; i<files.length && total<10; i++)
		{
			f = files[i].filename;

			if (f.indexOf(str)===0)
			{
				total++;
				hints.push(files[i].hint);
			}
		}

		return hints;
	},

	getAllCommands: function(search)
	{
		var result = [], len=search && search.length;

		function getCommands(cmds)
		{
			var key, fn, index;

			for (var i in cmds)
			{
				if (search && (index=i.indexOf(search))===-1)
					continue;

				fn = cmds[i];
				key = ide.keyboard.findKey(i);

				result.push(new ide.Item({
					key: key, title: i, className: 'cmd',
					icon: fn.icon,
					svgIcon: fn.svgIcon,
					description: fn.description,
					priority: index,
					matchStart: search && index, matchEnd: search && (index+len)
				}));
			}
		}

		getCommands(ide.commands);

		if (ide.editor)
		{
			getCommands(ide.editorCommands);
			getCommands(ide.editor.constructor.commands);
		}

		return result;
	},

	loadCommands: function(e)
	{
		var result = this.getAllCommands();

		e.reset();
		e.add(cxl.sortBy(result, 'title'));
	},

	getKeys: function(state)
	{
		var key, result = [];

		for (key in state)
			result.push({ key: state[key].key, title: state[key].action });

		return result;
	},

	loadKeymap: function(editor)
	{
	var
		state = ide.editor.keymap.state,
		items = []
	;
		editor.reset();

		editor.header.title = 'keymap: ' + (state||'');
		items = items.concat(this.getKeys(ide.editor.keymap.getState(state)));
		items = items.concat(this.getKeys(ide.keymap.getState(state)));

		items = cxl.sortBy(items, 'title');

		editor.add(items);
	},

	start: function()
	{
		ide.plugins.on('assist.inline', this.onAssistInline.bind(this));
	}

});

/**
 * Listen to inline assist events
 * Listen to assist events
 * Lookup best match
 */
ide.Command = class Command {

	constructor(name, def, scope)
	{
		var type = typeof(def), description = def.description;

		if (type==='string')
		{
			this.fn = function() { ide.run(def, arguments); };
			description = 'Alias of "' + def + '"';
		}
		else
			this.fn = type==='function' ? def : def.fn;

		this.icon = (!def.icon && !def.svgIcon) ? 'command' : def.icon;
		this.args = def.args;
		this.svgIcon = def.svgIcon;
		this.name = name;
		this.description = description;
		this.scope = scope;
	}

	parse(def)
	{
		def.run = (typeof(def.fn)==='string' ?
			this.plugin[def.fn] : def.fn).bind(this.plugin);
		def.cmd = def.cmd && def.cmd.split(' ');
		def.hint = { icon: 'command', description: def.help };

		if (!def.cmd)
			this.fn.help = def.help;
	}

	getToken(editor, token)
	{
	var
		result = [], ch = token.string,
		args = token.state.args, l=args.length-1,
		matches = this.def.filter(this.match.bind(this, args, false))
	;
		matches.forEach(function(def) {
			var name = def.cmd && def.cmd[l];

			if (name && name.indexOf(ch)===0)
			{
				def.hint.title = name;
				result.push(def.hint);
			}
		});

		return result;
	}

	match(args, exact, def)
	{
	var
		i=0, match={}, cmd = def.cmd, l=args.length, cur, arg,
		editor = ide.editor
	;
		if ((def.editor && !editor) || (l>0 && !cmd))
			return false;

		if (l>0 && cmd)
			for (; i<l; i++)
			{
				arg = args[i];
				cur = cmd[i];

				// Parameter
				if (cur && cur[0]==='@')
					match[cur.substr(1)] = arg;
				else if (!cur || (exact && cur !== arg) || (cur.indexOf(arg)!==0))
					return;

			}

		return (def.match = match);
	}

	apply(scope, args)
	{
		return this.fn.apply(scope || this.scope, args);
	}

};

})(this.ide, this.cxl, this._);
