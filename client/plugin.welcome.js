
(function(ide, j5ui) {
"use strict";

ide.plugins.register('welcome', ide.Plugin.extend({
	
	start: function()
	{
		j5ui.alert('Welcome ' + ide.project.get('env').USER);
		window.document.title = ide.project.get('name');
	}

}));

})(window.ide, window.j5ui);
