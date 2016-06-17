
(function(ide, cxl, _) {
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

function runArray(cmds)
{
	var result;

	cmds.forEach(function(cmd) {
		result = ide.run(cmd.fn, cmd.args);
	});

	return result;
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

		return commands.length>1 ? commands : commands[0];
	},

	/** Parses and executes command. */
	run: function(src)
	{
		var cmd = this.parse(src);

		return Array.isArray(cmd) ? runArray(cmd) :
			ide.run(cmd.fn, cmd.args);
	}

});

ide.commandParser = new CommandParser();

function tryCmd(commands, cmd, args)
{
	var fn = commands[cmd];

	if (!fn)
		return ide.Pass;

	return typeof(fn)==='string' ? ide.run(fn, args) : fn.apply(ide, args);
}

/** Execute command. */
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
		ide.workspace.add(result);
		result.focus();
	}

	return result;
};

/** @namespace */
ide.commands = {};
ide.editorCommands = {};

function addCmd(prop, name, def, scope)
{
	var type = typeof(def);

	if (name in prop)
		window.console.warn('Overriding command "' + name + '"');

	if (type==='function')
		def = scope ? def.bind(scope) : def;
	else if (type!=='string')
		def = new ide.Command(name, def, scope);

	prop[name] = def;
}

ide.registerCommand = addCmd.bind(this, ide.commands);

/**
 * Registers a command that only gets executed if an editor is active
 */
ide.registerEditorCommand = addCmd.bind(this, ide.editorCommands);

ide.plugins.register('cmd', {

	commands: {
		commands: function()
		{
			return this.openCommands({});
		},

		keymap: function()
		{
			return this.openKeymap({});
		},

		log: function()
		{
			return this.openLog({});
		}
	},

	onAssistInline: function(done, editor, token)
	{
		var hints, fn;

		if (editor === ide.commandBar && token.string)
		{
			if (token.state.fn!==token.string)
			{
				fn = this.getCommand(token.state.fn);

				hints = fn.getHints ? fn.getHints(editor, token) :
					this.getFiles(token.string);
			} else
				hints = this.getAllCommands(token.string, 'inline');

			done(hints);
		}
	},

	getCommand: function(name)
	{
		return ide.commands[name];
	},

	getFiles: function(str)
	{
	var
		hints = [],
		icons = [ 'file-o' ],
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
				hints.push({ title: f, icons: icons });
			}
		}

		return hints;
	},

	getAllCommands: function(search, type)
	{
		var result = [], icons = [ 'terminal' ];

		function getCommands(cmds, tag)
		{
			var tags, key;

			for (var i in cmds)
			{
				if (search && i.indexOf(search)!==0)
					continue;

				tags = tag ? [ tag ] : [];
				key = ide.keyboard.findKey(i);

				if (typeof(cmds[i])==='string')
					tags.push('alias:' + cmds[i]);

				result.push({
					key: key, title: i, className: 'cmd',
					tags: tags,
					icons: type === 'inline' ? icons : null
				});
			}
		}

		getCommands(ide.commands);
		getCommands(ide.editorCommands, 'editor');

		if (ide.editor)
			getCommands(ide.editor.commands, 'editor');

		return result;
	},

	loadCommands: function(e)
	{
		var result = this.getAllCommands();

		e.reset();
		e.add(_.sortBy(result, 'title'));
	},

	openCommands: function(options)
	{
		options.title = 'commands';
		options.plugin = 'cmd.openCommands';
		var editor = new ide.Editor.List(options);
		editor.listenTo(ide.plugins, 'editor.focus', this.loadCommands.bind(this, editor));
		return editor;
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
		var state, items = [];

		editor.reset();

		state = ide.editor.keymap.state;
		items = items.concat(this.getKeys(ide.editor.keymap.getState(state)));
		items = items.concat(this.getKeys(ide.keymap.getState(state)));

		items = _.sortBy(items, 'title');
		items.unshift({
			code: 'state', title: state, className: 'state'
		});

		editor.add(items);
	},

	openKeymap: function(options)
	{
		options.title = 'keymap';
		options.plugin = 'cmd.openKeymap';

		var editor = new ide.Editor.List(options);

		editor.listenTo(ide.plugins, 'editor.focus', this.loadKeymap.bind(this, editor));
		editor.listenTo(ide.plugins, 'editor.keymap', this.loadKeymap.bind(this, editor));

		return editor;
	},

	openLog: function(options)
	{
		return new ide.Editor.List({
			title: 'log', items: ide.logger.items, plugin: 'cmd.openLog',
			slot: options.slot
		});
	},

	start: function()
	{
		ide.plugins.on('assist.inline', this.onAssistInline.bind(this));
	}

});

ide.Command = function(name, def, plugin)
{
	// Listen to inline assist events
	// Listen to assist events
	// Lookup best match
	var fn = this.run.bind(this);

	this.name = name;
	this.def = def;
	this.plugin = plugin;

	def.forEach(this.parse, this);

	fn.getHints = this.getHints.bind(this);

	return fn;
};

ide.Command.prototype = {

	parse: function(def)
	{
		def.run = this.plugin[def.fn].bind(this.plugin);
		def.cmd = def.cmd.split(' ');
		def.hint = { icon: 'terminal' };
	},

	getHints: function(editor, token)
	{
		var result = [], ch = token.string;

		this.def.forEach(function(def) {
			var name = def.cmd[0];

			if (name.indexOf(ch)===0)
			{
				def.hint.title = name;
				result.push(def.hint);
			}
		});

		return result;
	},

	run: function()
	{
		return ide.Pass;
	}

};

})(this.ide, this.cxl, this._);
