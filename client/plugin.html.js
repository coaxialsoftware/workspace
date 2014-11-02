
(function(ide) {
"use strict";

ide.plugins.register('html', new ide.Plugin({

	autocomplete: function(file/*, pos*/)
	{
	var
		mime = file.get('mime')
	;
		if (mime !=='text/html')
			return;

	},

	start: function()
	{
		ide.on('autocomplete', this.autocomplete, this);
	}

}));

})(this.ide);