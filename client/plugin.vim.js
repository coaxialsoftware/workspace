/*
 * workspace - vim Plugin
 * 
 */

(function(ide, cxl) {
"use strict";
		
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
	
cxl.extend(Register.prototype, {
	
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
		
		enterSelectMode: function()
		{
			if (ide.editor && ide.editor.keymap)
			{
				ide.editor.keymap.state = 'vim-select';
				// TODO change cursor?
			}
		},
		
		enterBlockSelectMode: function()
		{
			if (ide.editor && ide.editor.keymap)
			{
				ide.editor.keymap.state = 'vim-block-select';	
				ide.editor.cmd('selectLine');
			}
		}
		
	},

	// Vim style bindings
	shortcuts: {
		vim: {
			backspace: 'goCharLeft',
			home: 'goLineStart',
			down: 'goLineDown',
			up: 'goLineUp',
			right: 'goCharRight',
			left: 'goCharLeft',
			pagedown: 'goPageDown',
			pageup: 'goPageUp',
			end: 'goLineEnd',
			space: 'goCharLeft',
			
			'alt+.': 'moveNext',
			'alt+,': 'movePrev',
			'mod+r': 'redo',
			'> >': 'indentMore',
			'< <': 'indentLess',
			'$': 'goLineEnd',
			'0': 'goLineStart',
			'/': 'search',
			':': 'ex',
			'= =': 'indentAuto',
			
			'a': 'goCharRight enterInsertMode',
			'shift+a': 'goLineEnd enterInsertMode',
			'b': 'goGroupLeft',
			'shift+d': 'delWrappedLineRight enterInsertMode',
			'd d': 'yankBlock deleteLine',
			'g t': 'nextEditor',
			'g g': 'goDocStart',
			'shift+g': 'goDocEnd',
			'g shift+t': 'prevEditor',
			'g f': 'find',
			'i': 'enterInsertMode',
			'y y': 'yankBlock',
			'shift+y': 'yankBlock',
			'p': 'put',
			
			'shift+v': 'enterBlockSelectMode',
			'mod+v': 'enterBlockSelectMode',
			'v': 'enterSelectMode',
			
			'h': 'goCharLeft',
			'j': 'goLineDown',
			'k': 'goLineUp',
			'l': 'goCharRight',
			'n': 'findNext',
			'o': 'goLineEnd enterInsertMode newlineAndIndent',
			'shift+o': 'goLineUp goLineEnd enterInsertMode newlineAndIndent',
			'u': 'undo',
			'w': 'goGroupRight'

		},
		
		'vim-select': {
			home: 'selectLineStart',
			down: 'selectDown',
			up: 'selectUp',
			right: 'selectRight',
			left: 'selectLeft',
			pagedown: 'selectPageDown',
			pageup: 'selectPageUp',
			end: 'selectLineEnd',
			'h': 'selectLeft',
			'j': 'selectDown',
			'k': 'selectUp',
			'l': 'selectRight',
			'd': 'yank deleteSelection enterNormalMode',
			'y': 'yank enterNormalMode',
			'>': 'indentMore enterNormalMode',
			'<': 'indentLess enterNormalMode',
			'w': 'selectGroupRight',
			'b': 'selectGroupLeft',
			'$': 'selectLineEnd',
			'0': 'selectLineStart',
			
			esc: 'enterNormalMode',
			'mod+[': 'enterNormalMode'
		},
					 
		'vim-block-select': {
			h: 'selectLeft selectLine',
			j: 'selectDown selectLine',
			k: 'selectUp selectLine',
			l: 'selectRight selectLine',
			
			d: 'yankBlock deleteSelection enterNormalMode',
			y: 'yankBlock enterNormalMode',
			'>': 'indentMore enterNormalMode',
			'<': 'indentLess enterNormalMode',
			
			esc: 'enterNormalMode',
			'mod+[': 'enterNormalMode'
		 },

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
	
})(this.ide, this.cxl);
