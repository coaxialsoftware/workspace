(function(ide) {
"use strict";
	
class TokenEditor extends ide.SourceEditor {
	
	render(p)
	{
		this.file = new ide.File();
		this.file.mime = 'application/json';
		
		super.render(p);
		
		this.listenTo(ide.plugins, 'token', this.onToken);
	}
	
	onToken(editor, token)
	{
		var json;
		
		try {
			json = JSON.stringify(token, null, 4);
		} catch(e)
		{
			json = 'Error stringifying token';
		}
		
		this.editor.setValue(json);
	}
	
}
	
	
ide.plugins.register('debug', {
	
	commands: {
		'debug.token': {
			fn: function()
			{
				return new TokenEditor({ plugin: this });
			},
			description: 'Show current token',
			icon: 'bug'
		},
		
		'debug.diff': {
			
			// TODO
			fn: function()
			{
			var
				file = ide.editor && ide.editor.file,
				diff = file && file.diff && file.diff(),
				newfile
			;
				if (!diff)
					return;

				newfile = new ide.File({
					content: JSON.stringify(diff, null, 2)
				});

				ide.open({ file: newfile }).then(function(editor) {
					editor.listenTo(file, 'change:content', function() {
						newfile.content = JSON.stringify(file.diff(), null, 2);
					});
					editor.cmd('insert.disable');
				});
			},
			description: 'Show File Diff for current editor',
			icon: 'bug'
		}
	}
	
});
	
	
})(this.ide);