/*
 * workspace - vim Plugin
 * 
 */

(function(ide, _) {
"use strict";

ide.plugins.register('vim', {
	
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

	ready: function()
	{
		if (ide.project.get('keymap')!=='vim')
			return;

		ide.workspace.on('add_child', this.setupEditor, this);
	},
	
	commands: {
		
		enterInsertMode: function()
		{
			var editor = ide.editor;

			if (editor && editor.keymap)
			{
				editor.keymap.state = 'vim-insert';
				editor.cmd('enableInput');
			}
		},
		
		enterNormalMode: function()
		{
			var editor = ide.editor;

			if (editor && editor.keymap)
			{
				editor.keymap.state = 'vim';
				editor.cmd('disableInput');
				editor.cmd('clearSelection');
			}
		},
		
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
			
			'alt+.': 'moveNext',
			'alt+,': 'movePrev',
			'mod+r': 'redo',
			'>': 'indentMore',
			'<': 'indentLess',
			'$': 'goLineEnd',
			'0': 'goLineStart',
			'/': 'search',
			":": 'ex',
			
			'a': 'goCharRight enterInsertMode',
			'shift+a': 'goLineEnd enterInsertMode',
			'b': 'goGroupLeft',
			'shift+d': 'delWrappedLineRight enterInsertMode',
			'd d': 'deleteLine',
			'g t': 'nextEditor',
			'g shift+t': 'prevEditor',
			'g f': 'find',
			'i': 'enterInsertMode',
			
			'shift+v': 'enterBlockSelectMode',
			'v': 'enterSelectMode',
			
			'h': 'goCharLeft',
			'j': 'goLineDown',
			'k': 'goLineUp',
			'l': 'goCharRight',
			'n': 'findNext',
			'o': 'goLineEnd enterInsertMode newlineAndIndent',
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
			
			esc: 'enterNormalMode',
			'mod+[': 'enterNormalMode'
		},
					 
		'vim-block-select': {
			h: 'selectLeft selectLine',
			j: 'selectDown selectLine',
			k: 'selectUp selectLine',
			l: 'selectRight selectLine',
			
			esc: 'enterNormalMode',
			'mod+[': 'enterNormalMode'
		 },

		'vim-insert': _.extend({}, ide.keymap.states.default, {
			backspace: 'delCharBefore',
			'mod+backspace': 'delGroupBefore',
			'mod+left': 'goGroupLeft',
			'mod+right': 'goGroupRight',
			'esc': 'enterNormalMode',
			'mod+[': 'enterNormalMode'
		})
	}

});
	
})(this.ide, this._);
 
