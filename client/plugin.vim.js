/*
 * workspace - vim Plugin
 * 
 */

(function(ide) {
"use strict";

function enterInsertMode()
{
	ide.action('enableInput');
	return false;
}

ide.plugins.register('vim', {

	ready: function()
	{
		if (ide.project.get('keymap')!=='vim')
			return;

		ide.workspace.on('add_child', function(editor) {
			// Start in normal mode
			if (editor && editor.action)
				editor.action('disableInput');
		});
	},

	// Vim style bindings
	shortcuts: {
		vim: {
			backspace: 'goCharLeft',
			home: 'goLineStartSmart',
			"g t": 'nextEditor',
			"g T": 'prevEditor',
			'alt+.': 'moveNext',
			'alt+,': 'movePrev',
			'j': 'goLineDown',
			'k': 'goLineUp',
			'l': 'goCharRight',
			'h': 'goCharLeft',
			down: 'goLineDown',
			up: 'goLineUp',
			right: 'goCharRight',
			left: 'goCharLeft',
			pagedown: 'goPageDown',
			pageup: 'goPageUp',
			end: 'goLineEnd',

			i: enterInsertMode
		},

		'vim-insert': {
			backspace: 'delCharBefore',
			'mod+left': 'goGroupLeft',
			'mod+right': 'goGroupRight'
		}
	}

});
	
})(this.ide);
 
