
(function(ide) {
"use strict";
	
var plugin = new ide.Plugin({
	
	delay: 250,
	
	files: null,
	
	editorCommands: {
		
		jshint: function()
		{
			plugin.getHints(ide.editor);
		}
		
	},
	
	getHints: function(e)
	{
		var file = e.file, version;
		
		if (file && e.mode==='text/javascript' && e.hints)
		{
			version = Date.now();
			this.files[e.id] = { editor: e, version: version };

			ide.socket.send('jshint', {
				$: e.id, p: ide.project.id,
				f: file.id, v: version, js: e.getValue()
			});
		}
	},
	
	updateHints: function(editor, errors)
	{
		editor.hints.clear('jshint');
		
		if (errors)
			errors.forEach(function(e) {
				editor.hints.add('jshint', {
					line: e.line,
					ch: e.character,
					type: e.id==='(error)' ? 'error' : 'warning',
					length: e.evidence && e.evidence.length,
					hint: e.reason 
				});
			});
	},
	
	onMessage: function(data)
	{
	var
		me = this,
		f = me.files[data.$]
	;
		if (f.version===data.v)
		{
			me.updateHints(f.editor, data.errors);
			delete me.files[data.$];
		}
	},
	
	ready: function()
	{
		this.files = {};
		
		ide.plugins.on('socket.message.jshint', this.onMessage, this);
		ide.plugins.on('editor.write', this.getHints, this);
		ide.plugins.on('editor.load', this.getHints, this);
	}
	
});
	
ide.plugins.register('jshint', plugin);
	
})(this.ide);