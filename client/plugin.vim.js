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
		ide.workspace.on('add_child', function(editor) {
			// Start in normal mode
			if (editor && editor.action)
				editor.action('disableInput');
		});
	},

	// Vim style bindings
	keys: {
		normal: {
			backspace: 'goCharLeft',
			home: 'goLineStartSmart',
			"g t": 'nextEditor',
			"g T": 'prevEditor',
			'alt+.': 'moveNext',
			'alt+,': 'movePrev',
			down: 'goLineDown',
			up: 'goLineUp',
			right: 'goCharRight',
			left: 'goCharLeft',
			pagedown: 'goPageDown',
			pageup: 'goPageUp',
			end: 'goLineEnd',

			i: enterInsertMode
		},

		insert: {
			backspace: 'delCharBefore',
			'mod+left': 'goGroupLeft',
			'mod+right': 'goGroupRight'
		}
	},

	shortcuts: null

});
	
})(this.ide);
 
