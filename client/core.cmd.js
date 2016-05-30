
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

		return Array.isArray(cmd) ? runArray(cmd) :
			ide.run(cmd.fn, cmd.args);
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

ide.plugins.register('cmd', {

	commands: {
		commands: function()
		{
			return this.openCommands({ plugin: this, file: 'commands' });
		},

		keymap: function()
		{
			return this.openKeymap({ plugin: this, file: 'keymap' });
		},

		log: function()
		{
			return this.openLog({ plugin: this });
		}
	},

	onAssist: function(done, editor, token)
	{
		var hints, files = ide.project.get('files'), i, total=0, f;

		if (editor === ide.commandBar && token.string && files)
		{
			hints = this.getAllCommands(token.string, 'inline');

			for (i=0; i<files.length && total<10; i++)
			{
				f = files[i].filename;

				if (f.indexOf(token.string)===0)
				{
					total++;
					hints.push({ title: f, type: 'inline' });
				}
			}

			done(hints);
		}
	},

	getAllCommands: function(search, type)
	{
		var result = [];

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
					key: key, title: i, className: 'cmd', tags: tags, type: type
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

		var editor = new ide.Editor.List(options);

		editor.listenTo(ide.plugins, 'editor.focus', this.loadKeymap.bind(this, editor));
		editor.listenTo(ide.plugins, 'editor.keymap', this.loadKeymap.bind(this, editor));

		return editor;
	},

	openLog: function(options)
	{
		options.title = 'log';
		options.items = ide.logger.items;
		options.file = 'log';
		return new ide.Editor.List(options);
	},

	open: function(options)
	{
		switch (options.file) {
		case 'commands':
			return this.openCommands(options);
		case 'keymap':
			return this.openKeymap(options);
		case 'log':
			return this.openLog(options);
		}
	},

	start: function()
	{
		ide.plugins.on('assist', this.onAssist.bind(this));
	}

});

})(this.ide, this.cxl, this._);
