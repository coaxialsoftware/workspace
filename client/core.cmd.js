
((ide, cxl) => {
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

	error(state, msg)
	{
		if (!state.silent)
			throw new Error("Column " + state.i + ': ' + msg);
	},

	parseUntil(args, state, end, fn)
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

	parseString(args, state)
	{
		this.parseUntil(args, state, /([^\\]")/g, JSON.parse);
	},

	parseRegex(args, state)
	{
		try {
			this.parseUntil(args, state, /([^\\]\/[gimy]*)/g, sandbox);
		} catch (e) {
			this.parseUntil(args, state, /$/g);
		}
	},

	parseJS(args, state)
	{
		state.i++;
		this.parseUntil(args, state, /([^\\])`/g, sandbox);
		state.i++;
	},

	parsePath(args, state)
	{
		this.parseUntil(args, state, /[^\\]([\s;])|$/g, function(a) {
			return a.replace(/\\ /g, ' ');
		});
	},

	parseCmd(args, state)
	{
		this.parseUntil(args, state, /[\s;\/]|$/g, null);
		this.ignoreSpace(args, state);
		return state.result[0];
	},

	ignoreSpace(args, state)
	{
		while (/\s/.test(args[state.i]))
			state.i++;
	},

	parseArguments(args, state)
	{
		state.result = [];

		while ((state.i < state.end) && args[state.i] !== ';')
		{
			switch(args[state.i]) {
			case '"': this.parseString(args, state); break;
			case '/':
				this.parseRegex(args, state);
				break;
			case '`': this.parseJS(args, state); break;
			default: this.parsePath(args, state); break;
			}

			this.ignoreSpace(args, state);
		}

		return state.result.length ? state.result : null;
	},

	parse(src, silent)
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
	run(src)
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
	try {
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

			ide.workspace.slot().attach(result);
			result.focus();
		}
	} catch(e)
	{
		ide.error(e);
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

	return (prop[name] = new ide.Command(name, def, scope, prop));
}

ide.registerCommand = addCmd.bind(this, ide.commands);

/**
 * Registers a command that only gets executed if an editor is active
 */
ide.registerEditorCommand = addCmd.bind(this, ide.editorCommands);

ide.plugins.register('core', {

	core: true,

	editorCommands: {

		openTab: {
			fn: function() {
				ide.openTab(ide.editor.hash.get());
				ide.workspace.remove(ide.editor);
			},
			description: 'Open current editor in new tab'
		},

		wq: function()
		{
			// TODO use one run.
			ide.run('w').run('q');
		},

		'workspace.next': function()
		{
			ide.workspace.next().focus();
		},

		'workspace.previous': function()
		{
			ide.workspace.previous().focus();
		},

		'workspace.swapNext': function()
		{
		var
			l = ide.workspace.slots.length, i
		;
			if (l>1)
			{
				i = ide.workspace.slots.indexOf(ide.editor.slot);
				ide.workspace.swap(i, (i === l-1) ? 0 : i+1);
			}
		},

		'workspace.swapPrevious': function()
		{
		var
			l = ide.workspace.slots.length, i
		;
			if (l>1)
			{
				i = ide.workspace.slots.indexOf(ide.editor.slot);
				ide.workspace.swap(i, (i === 0) ? l-1 : i-1);
			}

		}

	},

	commands: {

		browse(url)
		{
			var BROWSER_REGEX = /^\w:\/\//;

			// TODO should we default to http?
			if (!BROWSER_REGEX.test(url))
				url = 'http://' + url;

			return new ide.BrowserEditor({ url: url });
		},

		commands: {

			fn: function()
			{
				var editor = new ide.ListEditor({
					command: 'commands', plugin: this
				});

				editor.listenTo(ide.plugins, 'editor.focus', this.loadCommands.bind(this, editor));

				return editor;
			},
			description: 'Show commands for active editor',

		},

		keymap()
		{
			var editor = new ide.ListEditor({
				command: 'keymap', plugin: this
			});

			editor.listenTo(ide.plugins, 'editor.focus', this.loadKeymap.bind(this, editor));
			editor.listenTo(ide.plugins, 'editor.keymap', this.loadKeymap.bind(this, editor));

			return editor;
		},

		log()
		{
			return new ide.ListEditor({
				children: ide.logger.items,
				plugin: this, command: 'log'
			});
		},

		help(topic)
		{
			var url = ide.project.get('help.url') + (topic ? '#' + topic : '');

			window.open(url);
		},

		e: 'edit',

		/**
		 * Edits file with registered plugins.
		 * @param {string} ... Files to open.
		 */
		edit() {
			if (arguments.length)
				for (var i=0; i<arguments.length; i++)
					ide.open({ file: new ide.File(arguments[i]) });
			else
				ide.open({});
		},

		plugins() {
		const
			l = new ide.ListEditor({
				plugin: this,
				title: 'plugins',
				itemClass: ide.ComponentItem,
				file: 'list'
			})
		;
			cxl.ajax.get('plugins').then(function(all) {
				var a, i, items=[], item;

				if (!all)
					ide.warn('Could not retrieve plugins from server.');

				for (i in all)
				{
					a = all[i];
					item = new ide.PluginComponent({ data: a });
					item.key = i;
					items.push(item);
				}

				l.add(cxl.sortBy(items, 'key'));
			});

			return l;
		},

		'plugins.install': {
			fn: function(id) {
				var not = ide.notify({
					title: `Installing ${id} extension`,
					code: 'plugins.install',
					className: 'success',
					progress: 0
				});

				return cxl.ajax.post('plugins/install', {
					project: ide.project.id,
					id: id
				}).catch(() => ide.error(`Error installing ${id} extension`))
					.then(() => not.remove());
			},
			description: 'Install Plugin',
			args: [ 'plugin' ],
			icon: 'cog'
		},

		'plugins.uninstall': {
			fn: function(id) {
				var not = ide.notify({
					title: `Uninstalling ${id} extension`,
					code: 'plugins.uninstall',
					className: 'success',
					progress: 0
				});
				return cxl.ajax.post('plugins/uninstall', {
					project: ide.project.id,
					id: id
				}).catch(() => ide.error(`Error installing ${id} extension`))
					.then(() => not.remove());
			},
			description: 'Uninstall Plugin',
			args: [ 'plugin' ],
			icon: 'cog'
		},

		tabe(name)
		{
			ide.openTab(name);
		},

		close()
		{
			window.close();
		},

		quit: 'q',
		'quitAll': 'qa',
		'quitForce': 'q!',

		/// Quit Vim. This fails when changes have been made.
		q()
		{
			const editor = ide.editor;

			if (!editor)
				return window.close();

			editor.quit();
		},

		qa()
		{
			ide.workspace.closeAll();
		},

		/// Quit always, without writing.
		"q!"()
		{
			if (ide.editor)
				ide.editor.quit(true);
			else
				window.close();
		},

		'workspace.settings': {
			fn: function()
			{
				var prefix = ide.project.id==='.' ? '' : '../';

				ide.open({ file: prefix + 'workspace.json' });
			},
			icon: 'settings',
			description: 'Edit global settings'
		},

		version()
		{
			var p = ide.project;

			ide.notify({
				code: 'version',
				tags: ['workspace:' + p.get('workspace.version')],
				title: (p.get('name') || p.id) + ' ' + (p.get('version') || '')
			});
		}
	},

	onAssist: function(request)
	{
		var hints, token=request.features.token;

		if (token && token.type==='command' && token.value)
		{
			hints = this.getAllCommands(token.value);
			request.respondInline(hints);
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
		ide.plugins.on('assist', this.onAssist.bind(this));
	}

});

/**
 *
 */
ide.Command = class Command {

	constructor(name, def, scope, prop)
	{
		var type = typeof(def), description = def.description;

		if (type==='string' || type==='function')
			def = { fn: def };

		if (typeof(def.fn)==='string')
		{
			this.fn = function() { ide.run(def.fn, arguments); };
			description = description || 'Alias of "' + def.fn + '"';
		}
		else
			this.fn = def.fn;

		this.icon = def.icon || (scope && scope.icon) || 'command';
		this.args = def.args;
		this.name = name;
		this.description = description;
		this.scope = scope;
		this.prop = prop;
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

	destroy()
	{
		this.apply = null;
		cxl.pull(this.prop, this);
	}

	apply(scope, args)
	{
		return this.fn.apply(scope || this.scope, args);
	}

};

})(this.ide, this.cxl, this._);
