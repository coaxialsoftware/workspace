
(function(ide) {
"use strict";
	
ide.plugins.register('jshint', new ide.Plugin({
	
	editorCommands: {
		
		jshint: function()
		{
			if (ide.editor.file && ide.editor.mode==='javascript' &&
				ide.editor.addHint);
			{
				ide.socket.send('jshint', { f: ide.editor.file.id, js: ide.editor.getValue() });
			}
		}
		
	},
	
	onMessage: function(data)
	{
		window.console.log(data);
	},
	
	ready: function()
	{
		ide.plugins.on('socket.message.jshint', this.onMessage, this);
	}
	
}));
	
})(this.ide);