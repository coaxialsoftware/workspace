(function(ide) {
"use strict";
	
class TokenEditor extends ide.SourceEditor {
	
	render(p)
	{
		this.file = new ide.File();
		
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
		}
	}
	
});
	
	
})(this.ide);