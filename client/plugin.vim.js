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
		editor.action('disableInput');
	},

	ready: function()
	{
		if (ide.project.get('keymap')!=='vim')
			return;

		ide.workspace.on('add_child', this.setupEditor, this);
	},
	
	actions: {
		
		enterInsertMode: function()
		{
			var editor = ide.editor;

			if (editor)
			{
				editor.keyState = 'vim-insert';
				ide.action('enableInput');
			}
		},
		
		enterNormalMode: function()
		{
			var editor = ide.editor;

			if (editor)
			{
				// Go back one char if coming back from insert mode.
				if (editor.keyState==='vim-insert')
					editor.action('goCharLeft');
				
				editor.keyState = 'vim';
				ide.action('disableInput');
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
			
			'a': 'goCharRight enterInsertMode',
			'shift+a': 'goLineEnd enterInsertMode',
			'b': 'goGroupLeft',
			'shift+d': 'delWrappedLineRight enterInsertMode',
			'd d': 'deleteLine',
			"g t": 'nextEditor',
			"g T": 'prevEditor',
			'h': 'goCharLeft',
			'i': 'enterInsertMode',
			'j': 'goLineDown',
			'k': 'goLineUp',
			'l': 'goCharRight',
			'o': 'goLineEnd enterInsertMode newlineAndIndent',
			'u': 'undo',
			'w': 'goGroupRight'

		},

		'vim-insert': {
			backspace: 'delCharBefore',
			'mod+left': 'goGroupLeft',
			'mod+right': 'goGroupRight',
			'esc': 'enterNormalMode',
			'ctrl+[': 'enterNormalMode'
		}
	}

});
	
})(this.ide);
 
