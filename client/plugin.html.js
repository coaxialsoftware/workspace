
(function(ide) {
"use strict";

ide.plugins.register('html', new ide.Plugin({

	autocomplete: function(file, pos, token)
	{
		window.console.log(file, pos, token);
	},

	ready: function()
	{
		ide.plugins.get('autocomplete').register('text/html', this);
	}

}));

})(this.ide);