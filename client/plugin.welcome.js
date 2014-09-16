
(function(ide, _, $) {
"use strict";

ide.plugins.register('welcome', ide.Plugin.extend({

	el: '#projects',

	start: function()
	{
	var
		p = ide.project,
		projects = p.get('projects'),
		user = p.get('env').USER,
		project = p.get('name')
	;
		this.setElement('#projects');

		if (user)
			ide.alert('Welcome ' + user);
		if (project)
			window.document.title = project;

		if (ide.workspace.children.length)
			return;

		if (projects)
			this.renderProjects(projects);

		if (!ide.hash.data.file)
			this.show();

		ide.workspace.on('add_child', this.hide, this);
		ide.workspace.on('remove_child', this.on_remove_child, this);
	},

	on_remove_child: function()
	{
		if (ide.workspace.children.length===0)
			this.show();
	},

	hide: function()
	{
		this.$el.hide().css('opacity', 0);
	},

	show: function()
	{
		this.$el.show().css('opacity', 1);
	},

	renderProjects: function(projects)
	{
	var
		tplProject = _.template($('#tpl-project').html()),
		container = $('#projects')
	;

		_.each(projects, function(p) {
			container.append(tplProject(p));
		});

		container.find('.content').click(function(ev) {
			ide.commands.project(ev.currentTarget.dataset.path);
		});
	}

}));

})(window.ide, this._, this.jQuery);
