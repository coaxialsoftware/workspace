((ide, cxl) => {
"use strict";

/**
 * Try to execute action in editor or workspace.
 */
ide.action = function action(name)
{
var
	cmd = ide.commandParser.parse(name),
	handler = ide.runParsedCommand.bind(ide, cmd)
;
	handler.action = name;

	return handler;
};

function KeyboardManager()
{
	var _MAP = this.MAP;

	for (var i = 1; i < 20; ++i)
		_MAP[111 + i] = 'f' + i;

	for (i = 0; i <= 9; ++i)
		_MAP[i + 96] = i+'';

	for (i=65; i<91; ++i)
		_MAP[i] = String.fromCharCode(i).toLowerCase();

	// Make sure keydown is handled first, before the editor
	window.addEventListener('keydown', this.onKeyDown.bind(this), true);

	this.MODREPLACE = /Mac|iPod|iPhone|iPad/.test(navigator.platform) ? 'meta+' : 'ctrl+';
}

cxl.extend(KeyboardManager.prototype, {

	delay: 250,
	t: 0,
	sequence: null,
	// What to replace "mod" with, ctrl for win, meta for osx
	MODREPLACE: null,

	PARSESHIFT: /shift\+/,
	PARSECTRL: /ctrl\+/,
	PARSEALT: /(?:alt|option)\+/,
	PARSEMETA: /(?:meta|command)\+/,
	PARSECH: /([^\+]+)$/,

	MAP: {
		8: 'backspace', 9: 'tab', 13: 'enter', 	17: 'ctrl',
		18: 'alt', 20: 'capslock', 27: 'esc', 32: 'space',
		33: 'pageup', 34: 'pagedown', 35: 'end', 36: 'home',
		37: 'left', 38: 'up', 39: 'right', 40: 'down',
		45: 'ins', 46: 'del', 91: 'meta', 93: 'meta',
		224: 'meta', 106: '*', 107: 'plus', 109: '-',
		110: '.', 111 : '/', 186: ';', 187: '=',
		188: ',', 189: '-', 190: '.', 191: '/',
		192: '`', 219: '[', 220: '\\', 221: ']', 222: '\''
	},

	MODMAP: {
		16: 'shift', 17: 'ctrl', 18: 'alt',
		93: 'meta', 224: 'meta'
	},

	SHIFTMAP: {
		192: '~', 222: '"', 221: '}', 220: '|',
		219: '{', 191: '?', 190: '>', 189: '_',
		188: '<', 187: 'plus', 186: ':', 48: ')',
		49: '!', 50: '@', 51: '#', 52: '$', 53: '%',
		54: '^', 55: '&', 56: '*', 57: '('
	},

	getChar: function(ev)
	{
	var
		key = ev.keyCode || ev.which,
		ch = ev.ch
	;
		if (!ch)
		{
			if (this.MODMAP[key])
				return;
			if (ev.shiftKey && (ch = this.SHIFTMAP[key]))
				ev.noShift = true;
			else
				ch = this.MAP[key];

			if (ch===undefined)
				ch = String.fromCharCode(key);
		}

		return ch;
	},

	getKeyId: function(ev)
	{
	var
		ch = this.getChar(ev),
		result
	;
		if (!ch)
			return;
		if (ev.ctrlKey)
			result = 'ctrl';
		if (ev.altKey)
			result = result ? result + '+alt' : 'alt';
		if (ev.shiftKey && !ev.noShift)
			result = result ? result + '+shift' : 'shift';
		if (ev.metaKey)
			result = result ? result + '+meta' : 'meta';

		return result ? result+'+'+ch : ch;
	},

	onKeyDown: function(ev)
	{
		if (this.disabled)
			return;

	var
		t = Date.now(),
		k = this.getKeyId(ev),
		seq
	;
		if (!k)
			return;

		if (t - this.t < this.delay)
			this.sequence.push(k);
		else
			this.sequence = [ k ];

		seq = this.sequence.slice(0);

		do {
			if (this.handleKey(seq.join(' '))!==false)
			{
				ev.stopPropagation();
				ev.preventDefault();
				t = 0;
				break;
			}
			seq.shift();
		} while (seq.length);

		this.t = t;
	},

	_findKey: function(keymap, state, action)
	{
		state = state || keymap.getState();

		for (var i in state)
			if (state[i].action===action)
				return i;
	},

	findKey: function(action, state)
	{
	var
		keymap = ide.editor && ide.editor.keymap,
		result
	;
		if (keymap)
			result = this._findKey(keymap, state, action);

		if (!result)
			result = this._findKey(ide.keymap, state, action);

		return result;
	},

	/**
	 * Handles Key. First checks if there is a keymap defined for the
	 * current editor.
	 */
	handleKey: function(key)
	{
	var
		keymap = ide.editor && ide.editor.keymap,
		state = keymap && keymap.state,
		result = false
	;
		if (keymap)
			result = keymap.handle(key);

		if (result===false)
			result = ide.keymap.handle(key, state);

		return result===ide.Pass ? false : result;
	},

	parseKey: function(key)
	{
	var
		sequence = key.replace(/mod\+/g, this.MODREPLACE).split(' '),
		i = sequence.length,
		k, shortcut
	;
		while (i--)
		{
			shortcut = sequence[i];
			k = this.PARSECH.exec(shortcut);

			if (!k)
				window.console.warn('Invalid shortcut ' + key);
			else
				sequence[i] = {
					ctrlKey: this.PARSECTRL.test(shortcut),
					altKey: this.PARSEALT.test(shortcut),
					shiftKey: this.PARSESHIFT.test(shortcut),
					metaKey: this.PARSEMETA.test(shortcut),
					ch: k[1]
				};
		}

		return sequence;
	},

	normalize: function(key)
	{
	var
		sequence = this.parseKey(key),
		i = sequence.length
	;
		while (i--)
			sequence[i] = this.getKeyId(sequence[i]);

		return sequence.join(' ');
	}

});

function KeyMap(editor)
{
	this.editor = editor;
	this.states = {};

	if (editor && editor.keymap)
		this.state = editor.keymap;
}

cxl.extend(KeyMap.prototype, {

	defaultState: null,
	state: null,

	/**
	 * Object with shortcuts as keys and actions as values.
	 */
	states: null,

	start: function()
	{
		if (!this.state)
			this.state = (ide.project && ide.project.get('keymap')) ||
				this.defaultState || 'default';
	},

	createHandler: function(map, key)
	{
	var
		fn = map[key],
		handler
	;
		if (typeof(fn)==='function')
		{
			handler = fn.bind(ide);
			handler.action = fn.action || fn.name;
		} else
		{
			handler = ide.action(fn);
		}

		handler.key = key;

		return handler;
	},

	registerKey: function(state, key, handler)
	{
		state[key] = handler;
	},

	registerState: function(state, map)
	{
	var
		key
	;
		state = this.states[state] || (this.states[state]={});

		for (key in map)
			this.registerKey(state, ide.keyboard.normalize(key), this.createHandler(map, key));
	},

	registerKeys: function(map)
	{
		for (var state in map)
			this.registerState(state, map[state]);
	},

	getState: function(state)
	{
		return this.states[state || this.state];
	},

	setState: function(state)
	{
		this.state = state;

		if (this.editor)
			ide.plugins.trigger('editor.keymap', this, this.editor);
	},

	getHandler: function(key, state)
	{
	var
		map = this.states[state || this.state],
		fn = map && (map[key] || map.all)
	;
		return fn;
	},

	/**
	 * Handles key in current state, or optional state parameter.
	 */
	handle: function(key, state)
	{
		var fn = this.getHandler(key, state);

		return fn ? fn(key) : false;
	}

});

ide.keyboard = new KeyboardManager();
ide.keymap = new KeyMap();

/**
 * Global keymap handler. Make sure to fallback to default bindings
 */
ide.keymap.handle = function(key, state)
{
var
	handle = KeyMap.prototype.handle,
	result=false,
	uiState = this.uiState
;
	if (uiState)
	{
		result = handle.call(this, key, this.uiState);
		if (state===uiState)
			return result;
	}

	if (result===false)
		result = handle.call(this, key, state);

	state = state || this.state;

	if (result===false && state !== 'default')
		result = handle.call(this, key, 'default');

	return result;
};

/**
 * Sets the UI state. UI States have a higher priority than global states, but lower
 * than editor states.
 */
ide.keymap.setUIState = function(state)
{
	this.uiState = state;
};

ide.keymap.registerKeys({

	/**
	 * Default Keymap
	 */
	default: {

		// MOTION
		home: 'line.goStart',
		end: 'line.goEnd',
		down: 'cursor.goDown',
		up: 'cursor.goUp',
		right: 'cursor.goForward',
		left: 'cursor.goBackwards',
		pagedown: 'page.goDown',
		pageup: 'page.goUp',
		f1: 'help',
		f10: 'assist',

		// WORKSPACE
		"alt+left": 'workspace.previous',
		"alt+right": 'workspace.next',
		'alt+.': 'workspace.swapNext',
		'alt+,': 'workspace.swapPrevious',
		'alt+down': 'line.moveDown',
		'alt+up': 'line.moveUp',
		'alt+enter': 'ex',
		'alt+u': 'selection.redo',

		// SELECTION
		'shift+left': 'selection.begin; cursor.goBackwards; selection.end',
		'shift+right': 'selection.begin; cursor.goForward; selection.end',
		'shift+up': 'selection.begin; cursor.goUp; selection.end',
		'shift+down': 'selection.begin; cursor.goDown; selection.end',
		'shift+home': 'selection.begin; line.goStart; selection.end',
		'shift+end': 'selection.begin; line.goEnd; selection.end',
		'shift+pagedown': 'selection.begin; page.goDown; selection.end',
		'shift+pageup': 'selection.begin; page.goUp; selection.end',
		'shift+mod+left': 'selection.begin; word.goPrevious; selection.end',
		'shift+mod+right': 'selection.begin; word.goNext; selection.end',

		// EDITING
		backspace: 'insert.backspace',
		del: 'insert.del',
		enter: 'cursor.enter',
		'shift+enter': 'cursor.enter 1',
		'mod+enter': 'line.goEnd; cursor.enter 0 1',
		'shift+mod+enter': 'cursor.enter 1 1',
		insert: 'insert.toggleOverwrite',
		'shift+backspace': 'insert.backspace',

		'mod+backspace': 'word.removePrevious',
		'mod+del': 'word.removeNext',
		'mod+end': 'cursor.goEnd',
		'mod+down': 'scroll.down',
		'mod+home': 'cursor.goStart',
		'mod+left': 'word.goPrevious',
		'mod+right': 'word.goNext',
		'mod+up': 'scroll.up',
		'mod+pageup': 'scrollScreenUp',
		'mod+pagedown': 'scrollScreenDown',

		'mod+a': 'selection.selectAll',
		'mod+d': 'search.next',
		'mod+f': 'searchbar',
		'mod+i': 'line.select',
		'mod+u': 'selection.undo',
		'mod+s': 'write',
		'mod+y': 'history.redo',
		'mod+z': 'history.undo',

		'mod+[': 'indent.less',
		'mod+]': 'indent.more',

		'shift+mod+f': 'search.replace',
		'shift+mod+k': 'line.remove',
		'shift+mod+r': 'search.replaceRange',
		'shift+mod+u': 'selection.redo',
		'shift+mod+z': 'history.redo',

		'tab': 'insert.tab',
		'shift+tab': 'indent.auto'
	},

	terminal: {
		'alt+enter': 'ex'
	}

});

ide.KeyMap = KeyMap;

})(this.ide, this.cxl);
