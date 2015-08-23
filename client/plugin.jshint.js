
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
			this.send({
				$: e.id, p: ide.project.id,
				f: file.id, v: version, js: e.getValue()
			});
		}
	},
	
	updateHints: function(editor, errors)
	{
		editor.hints.clear('jshint');
		
		if (errors)
		{
			errors.forEach(function(e) {
				editor.hints.add('jshint', {
					line: e.line,
					ch: e.character,
					type: e.id==='(error)' ? 'error' : 'warning',
					length: e.evidence && e.evidence.length,
					hint: e.reason 
				});
			});
		}
	},
	
	onMessage: function(data)
	{
	var
		f = this.files[data.$]
	;
		if (f.version===data.v)
		{
			this.updateHints(f.editor, data.errors);
			delete this.files[data.$];
		}
	},
	
	ready: function()
	{
		this.files = {};
		this.listenTo('socket.message.jshint', this.onMessage)
			.listenTo('editor.write', this.getHints)
			.listenTo('editor.load', this.getHints)
		;
	}
	
});
	
ide.plugins.register('jshint', plugin);
	
})(this.ide);