/*
 * workspace - vim Plugin
 * 
 */

(function(ide, _) {
"use strict";
	
var
	MOTION = {
		h: 'goCharLeft',
		l: 'goCharRight',
		0: 'goLineStart',
		$: 'goLineEnd',
		home: 'goLineStart',
		end: 'goLineEnd',
		k: 'goLineUp',
		j: 'goLineDown',
		w: 'goGroupRight',
		b: 'goGroupLeft',
		down: 'goLineDown',
		up: 'goLineUp',
		right: 'goCharRight',
		left: 'goCharLeft',
		pagedown: 'goPageDown',
		pageup: 'goPageUp'
	},
	
	PRINTCHAR = {
		plus: '+',
		space: ' ',
		tab: "\t"
	}
	/*,

	DIGIT = { 1: '', 2: '', 3: '', 4: '', 5: '', 6: '', 7:'', 8:'', 9:'' },*/
;
	
function map(keymap, prefix, postfix)
{
	return _.reduce(keymap, function(result, v, k) {
		result[k] = (prefix ? prefix + ' ' : '') + v + (postfix ? ' ' + postfix : '');
		return result;
	}, {});
}
		
/**
 * Helper function for commands. Makes sure there is a valid editor
 */
function verify(fn)
{
	return function() {
		if (ide.editor && ide.editor.keymap)
			fn.call(this, ide.editor);
	};
}
	
function setState(name)
{
	return function() {
		if (ide.editor && ide.editor.keymap)
			ide.editor.keymap.state = name;
	};
}
	
function yank(data)
{
	vim.register.set(data);
	
	for (var i=9; i>0; i--)
		vim.registers[i].set(vim.registers[i-1].data);
	
	vim.registers[0].set(data);
}

function Register(name)
{
	this.name = name;
	this.update();
}
	
_.extend(Register.prototype, {
	
	name: null,
	data: null,
	
	update: function()
	{
		this.data = vim.data('register.' + this.name);
	},
	
	set: function(data)
	{
		this.data = data || '';
		vim.data('register.' + this.name, this.data);
	}
		
});

var vim = new ide.Plugin({
	
	registers: null,
	
	// VIM Mode only supported for editors that have their own keymap.
	setupEditor: function(editor)
	{
		// Start in normal mode
		if (editor.keymap)
		{
			editor.keymap.state = 'vim';
			editor.cmd('disableInput');
			editor.cmd('showCursorWhenSelecting');
		}
	},
	
	initRegisters: function()
	{
		var r = this.registers = {
			'"': this.register = new Register('"'),
			'.': this.dotRegister = new Register('.'),
			'*': this.clipboardRegister = new Register('*')
		};
		
		for (var i=0; i<10; i++)
			r[i] = new Register(i);
	},
	
	updateRegisters: function()
	{
		for (var i in this.registers)
			this.registers[i].update();
	},
	
	onFocus: function()
	{
		this.updateRegisters();
	},

	ready: function()
	{
		if (ide.project.get('keymap')!=='vim')
			return;

		this.initRegisters();
		
		ide.workspace.on('add_child', this.setupEditor, this);
		ide.win.addEventListener('focus', this.onFocus.bind(this));
	},
	
	commands: {
		
		yank: verify(function(editor) {
			yank(editor.getSelection());
		}),
		
		insertDotRegister: function()
		{
			if (ide.editor)
				ide.editor.cmd('insert', [ vim.dotRegister.data ]);
		},
		
		insertCharacterBelow: function()
		{
			var e = ide.editor, pos, ch;

			if (e && e.getPosition && e.getChar && e.insert)
			{
				pos = e.getPosition();
				pos.line += 1;
				ch = e.getChar(pos);
				
				if (ch)
					e.insert(ch);
			}
		},
		
		put: verify(function(editor) {
			var data = this.register.data;
			
			if (data[0]==="\n" && !editor.somethingSelected())
				editor.cmd('goLineEnd');
			
			editor.cmd('replaceSelection', [ this.register.data ]);
		}),
		
		yankBlock: verify(function(editor)
		{
			var data = editor.somethingSelected() ? 
				editor.getSelection() :
				editor.getLine();
			
			yank("\n" + data);
		}),
		
		enterInsertMode: function()
		{
			var editor = ide.editor;

			if (editor && editor.keymap)
			{
				editor.keymap.state = 'vim-insert';
				editor.cmd('enableInput');
			}
		},
		
		enterNormalMode: verify(function(editor)
		{
			var lastInsert = editor.cmd('lastInsert');

			editor.keymap.state = 'vim';
			editor.cmd('disableInput');
			editor.cmd('clearSelection');
				
			if (lastInsert)
				vim.dotRegister.set(lastInsert);
		}),
		
		enterChangeMode: setState('vim-change'),
		enterSelectMode: setState('vim-select'),
		enterDeleteMode: setState('vim-delete'),
		enterYankMode: setState('vim-yank'),
		enterReplaceMode: setState('vim-replace'),
		enterBlockSelectMode: setState('vim-block-select')
		
	},

	// Vim style bindings
	shortcuts: {
		vim: _.extend({
			backspace: 'goCharLeft',
			space: 'goCharLeft',
			
			'alt+.': 'moveNext',
			'alt+,': 'movePrev',
			'mod+r': 'redo',
			'> >': 'indentMore',
			'< <': 'indentLess',
			'/': 'searchbar',
			':': 'ex',
			'= =': 'indentAuto',
			
			'a': 'goCharRight enterInsertMode',
			'shift+a': 'goLineEnd enterInsertMode',
			'shift+d': 'delWrappedLineRight enterInsertMode',
			'g t': 'nextEditor',
			'g g': 'goDocStart',
			'shift+g': 'goDocEnd',
			'g shift+t': 'prevEditor',
			'g f': 'find',
			'shift+y': 'yankBlock',
			'p': 'put',
			'n': 'findNext',
			'o': 'goLineEnd enterInsertMode newlineAndIndent',
			'shift+o': 'goLineUp goLineEnd enterInsertMode newlineAndIndent',
			'u': 'undo',
			
			// MODE SWITCH
			'i': 'enterInsertMode',
			'shift+v': 'selectLine enterBlockSelectMode',
			'mod+v': 'enterBlockSelectMode',
			'v': 'enterSelectMode',
			'c': 'enterChangeMode',
			'd': 'enterDeleteMode',
			'y': 'enterYankMode',
			'r': 'enterReplaceMode'
		}, MOTION),
		
		'vim-replace': {
			
			esc: 'enterNormalMode',
			'mod+[': 'enterNormalMode',
			
			all: function(key) {
				
				if (key in PRINTCHAR)
					key = PRINTCHAR[key];
				
				if (ide.editor && ide.editor.replaceSelection &&
					key.length===1)
					ide.editor.replaceSelection(key);
				ide.cmd('enterNormalMode');
			}
			
		},
		
		'vim-yank': _.extend({
			esc: 'enterNormalMode',
			'mod+[': 'enterNormalMode',
			'y': 'yankBlock enterNormalMode'
		}, map(MOTION, 'startSelect', 'endSelect yank clearSelection enterNormalMode')),
		
		'vim-change': _.extend({
			esc: 'enterNormalMode',
			'mod+[': 'enterNormalMode'
		}, map(MOTION, 'startSelect', 'endSelect deleteSelection enterInsertMode')),
		
		'vim-delete': _.extend({
			esc: 'enterNormalMode',
			'mod+[': 'enterNormalMode',
			'd': 'yankBlock deleteLine enterNormalMode',
		}, map(MOTION, 'startSelect', 'endSelect yank deleteSelection enterNormalMode')),
		
		'vim-select': _.extend({
			'd': 'yank deleteSelection enterNormalMode',
			'y': 'yank enterNormalMode',
			'>': 'indentMore enterNormalMode',
			'<': 'indentLess enterNormalMode',
			'p': 'put enterNormalMode',
			
			esc: 'enterNormalMode',
			'mod+[': 'enterNormalMode'
		}, map(MOTION, 'startSelect', 'endSelect')),
					 
		'vim-block-select': _.extend({
			d: 'yankBlock deleteSelection enterNormalMode',
			y: 'yankBlock enterNormalMode',
			p: 'put enterNormalMode',
			'>': 'indentMore enterNormalMode',
			'<': 'indentLess enterNormalMode',
			
			esc: 'enterNormalMode',
			'mod+[': 'enterNormalMode'
		 }, map(MOTION, 'startSelect', 'selectLine endSelect')),

		'vim-insert': {
			'mod+@': 'insertDotRegister enterNormalMode',
			'mod+a': 'insertDotRegister',
			'mod+d': 'indentLess',
			'mod+h': 'delCharBefore',
			'mod+j': 'newlineAndIndent',
			'mod+m': 'newlineAndIndent',
			'mod+t': 'indentMore',
			'mod+w': 'delWordAfter',
			
			backspace: 'delCharBefore',
			tab: 'insertTab',
			del: 'delCharAfter',
			pageup: 'goPageUp',
			pagedown: 'goPageDown',
			enter: 'newline',
			'shift+up': 'goPageUp',
			'shift+down': 'goPageDown',
			'mod+home': 'goDocStart',
			'mod+end': 'goDocEnd',
			'mod+backspace': 'delGroupBefore',
			'mod+left': 'goGroupLeft',
			'mod+right': 'goGroupRight',
			'shift+left': 'goGroupLeft',
			'shift+right': 'goGroupRight',
			'esc': 'enterNormalMode',
			'mod+[': 'enterNormalMode',
			'mod+del': 'delGroupAfter',
		}
	}

});

ide.plugins.register('vim', vim);
	
})(this.ide, this._);
