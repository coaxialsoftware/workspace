
(function(ide, _) {
"use strict";

ide.plugins.register('welcome', ide.Plugin.extend({

	template: null,

	start: function()
	{
		ide.alert('Welcome ' + ide.project.get('env').USER);
		window.document.title = ide.project.get('name');

		_.each(ide.project.get('projects'), this.renderProjects, this);
	},

	renderProjects: function()
	{
		//ide.workspace.$el.append()
	}

}));

})(window.ide, this._);
