
(function(ide, $) {
"use strict";

ide.plugins.register('javascript', new ide.Plugin({

	autocomplete: function(file, pos)
	{
	var
		mime = file.get('mime')
	;
		if (mime==='application/javascript')
			return (new $.Deferred()).then($.get('/autocomplete', {
				project: ide.project.get('path'),
				mime: mime,
				file: file.get('filename'),
				pos: pos
			}))
		;
	},

	start: function()
	{
		ide.on('autocomplete', this.autocomplete, this);
	}

}));

})(this.ide, this.jQuery);
