/*
 * workspace - vim Plugin
 * 
 */

(function(ide) {
"use strict";

ide.plugins.register('vim', {
	
	setupEditor: function(editor)
	{
		// Start in normal mode
		editor.keyState = 'vim';
		editor.cmd('disableInput');
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

			if (editor)
			{
				editor.keyState = 'vim-insert';
				editor.cmd('enableInput');
			}
		},
		
		enterNormalMode: function()
		{
			var editor = ide.editor;

			if (editor)
			{
				// Go back one char if coming back from insert mode.
				if (editor.keyState==='vim-insert')
					editor.cmd('goCharLeft');
				
				editor.keyState = 'vim';
				editor.cmd('disableInput');
			}
		}
		
	},

	// Vim style bindings
	shortcuts: {
		vim: {
			backspace: 'goCharLeft',
			home: 'goLineStartSmart',
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
			'h': 'goCharLeft',
			'i': 'enterInsertMode',
			'j': 'goLineDown',
			'k': 'goLineUp',
			'l': 'goCharRight',
			'n': 'findNext',
			'o': 'goLineEnd enterInsertMode newlineAndIndent',
			'u': 'undo',
			'w': 'goGroupRight'

		},

		'vim-insert': {
			backspace: 'delCharBefore',
			'mod+backspace': 'delGroupBefore',
			'mod+left': 'goGroupLeft',
			'mod+right': 'goGroupRight',
			'esc': 'enterNormalMode',
			'ctrl+[': 'enterNormalMode'
		}
	}

});
	
})(this.ide);
 
