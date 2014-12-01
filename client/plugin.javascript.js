
(function(ide, $) {
"use strict";

ide.plugins.register('javascript', new ide.Plugin({

	plugin: null,

	autocomplete: function(editor)
	{
	var
		file = editor.file,
		pos = editor.get_position(),
		mime = file.get('mime')
	;
		$.get('/autocomplete', {
			project: ide.project.get('path'),
			mime: mime,
			file: file.get('filename'),
			pos: pos
		});
	},

	ready: function()
	{
		this.plugin = ide.plugins.get('autocomplete')
			.register('application/javascript', this);
	}

}));

})(this.ide, this.jQuery);
