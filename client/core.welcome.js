
(function(ide, _, $) {
"use strict";

ide.plugins.register('welcome', new ide.Plugin({

	commands: {
		hello: function() {
			ide.notify('Hello, ' + ide.project.get('user'));
		}
	},

	el: '#projects',

	start: function()
	{
	var
		p = ide.project,
		projects = p.get('projects'),
		user = p.get('user'),
		project = p.get('name')
	;
		this.$el = $(this.el);

		if (user)
			ide.alert('Welcome ' + user);
		if (project)
		{
			window.document.title = project;
			$('#subtitle').html(project);
		}
		
		$('#title > small').html(ide.version);

		if (projects)
		{
			this.renderProjects(projects);

			this.show();
		}
	},

	show: function()
	{
		this.$el.css('display', 'block').css('opacity', 1);
	},

	renderProjects: function(projects)
	{
	var
		tplProject = _.template($('#tpl-project').html()),
		container = $('#projects'),
		all = _.sortBy(projects, 'name')
	;
		container.html(tplProject({
			projects: all,
			version: ide.project.get('version')
		}));

		container.find('.content').click(function(ev) {
			ide.commands.project(ev.currentTarget.dataset.path);
			ev.preventDefault();
		});
	}

}));

})(window.ide, this._, this.jQuery);
