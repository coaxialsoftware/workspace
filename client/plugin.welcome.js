
(function(ide) {
"use strict";

ide.plugins.register('welcome', ide.Plugin.extend({

	start: function()
	{
		ide.alert('Welcome ' + ide.project.get('env').USER);
		window.document.title = ide.project.get('name');
	}

}));

})(window.ide);
