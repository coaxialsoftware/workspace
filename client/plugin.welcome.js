
(function(ide, _, $) {
"use strict";

ide.plugins.register('welcome', ide.Plugin.extend({

	start: function()
	{
		ide.alert('Welcome ' + ide.project.get('env').USER);
		window.document.title = ide.project.get('name');

		this.renderProjects(ide.project.get('projects'));
	},

	renderProjects: function(projects)
	{
		if (!projects)
			return;

	var
		tplProject = _.template($('#tpl-project').html()),
		container = $('#projects')
	;

		_.each(projects, function(p) {
			container.append(tplProject(p));
		});
	}

}));

})(window.ide, this._, this.jQuery);
