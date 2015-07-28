/**
 *
 */

(function (ide, cxl) {
"use strict";

function KeyboardManager()
{
	var _MAP = this.MAP;

	for (var i = 1; i < 20; ++i)
		_MAP[111 + i] = 'f' + i;

	for (i = 0; i <= 9; ++i)
		_MAP[i + 96] = i+'';
	
	for (i=65; i<91; ++i)
		_MAP[i] = String.fromCharCode(i).toLowerCase();

	window.addEventListener('keydown', this.onKeyDown.bind(this));

	this.MODREPLACE = /Mac|iPod|iPhone|iPad/.test(navigator.platform) ? 'meta+' : 'ctrl+';
	this.states = {};
	this.state = 'default';
}
	
cxl.extend(KeyboardManager.prototype, {

	delay: 250,
	t: 0,
	sequence: null,
	
	state: null,
	states: null,

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
		mods = [],
		ch = this.getChar(ev)
	;
		if (!ch)
			return;
		if (ev.ctrlKey)
			mods.push('ctrl');
		if (ev.altKey)
			mods.push('alt');
		if (ev.shiftKey && !ev.noShift)
			mods.push('shift');
		if (ev.metaKey)
			mods.push('meta');

		mods.push(ch);
		
		return mods.join('+');
	},

	onKeyDown: function(ev)
	{
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
				ev.preventDefault();
				ev.stopPropagation();
				t = 0;
				break;
			}
		} while (seq.shift());

		this.t = t;
	},

	/**
	 * Handles Key
	 */
	handleKey: function(key)
	{
	var
		state = this.states[ide.editor && ide.editor.keyState || this.state],
		fn = state[key]
	;
		return fn ? fn() : false;
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
	},

	getHandler: function(fn)
	{
		var handler = typeof(fn)==='function' ?
			fn :
			ide.action.bind(ide, fn);

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
			this.registerKey(state, this.normalize(key), this.getHandler(map[key]));
	},

	registerKeys: function(map)
	{
		for (var state in map)
			this.registerState(state, map[state]);
	}

});

ide.keymap = new KeyboardManager();
	
ide.keymap.registerKeys({
	
	/**
	 * Default Keymap
	 */
	default: {
		backspace: 'delCharBefore',
		home: 'goLineStartSmart',
		del: 'delCharAfter',
		enter: 'newlineAndIndent',
		down: 'goLineDown',
		up: 'goLineUp',
		right: 'goCharRight',
		end: 'goLineEnd',
		insert: 'toggleOverwrite',
		left: 'goCharLeft',
		pagedown: 'goPageDown',
		pageup: 'goPageUp',
		'shift+backspace': 'delCharBefore',
		"alt+left": 'nextEditor',
		"alt+right": 'prevEditor',
		'alt+.': 'moveNext',
		'alt+,': 'movePrev',
		'alt+enter': 'ex',
		'mod+s': 'write',
		'mod+y': 'redo',
		'mod+z': 'undo',
		'mod+f': 'search',
		'alt+u': 'redoSelection',
		'mod+a': 'selectAll',
		'mod+backspace': 'delGroupBefore',
		'mod+d': 'deleteLine',
		'mod+end': 'goDocEnd',
		'mod+delete': 'delGroupAfter',
		'mod+down': 'goLineDown',
		'mod+g': 'findNext',
		'mod+home': 'goDocStart',
		'mod+left': 'goGroupLeft',
		'mod+right': 'goGroupRight',
		'mod+up': 'goLineUp',
		'mod+u': 'undoSelection',
		'mod+[': 'indentLess',
		'mod+]': 'indentMore',
		'shift+mod+f': 'replace',
		'shift+mod+r': 'replaceAll',
		'shift+mod+u': 'redoSelection',
		'shift+mod+z': 'redo',
		'shift+left': 'goCharLeft',
		'shift+right': 'goCharRight',
		'shift+up': 'goLineUp',
		'shift+down': 'goLineDown',
		'tab': 'defaultTab',
		'shift+tab': 'indentAuto'
	}
});
	
})(this.ide, this.cxl);