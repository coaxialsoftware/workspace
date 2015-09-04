
(function(ide, _, $) {
"use strict";
	
var ProjectList = ide.FileList.extend({
	
	title: 'projects',
	file: 'projects',
	
	file_template: '#tpl-project',
	
	_setup: function()
	{
		var projects = ide.project.get('projects');
		
		ide.FileList.prototype._setup.call(this);
		
		if (projects)
			this._renderProjects(projects);
		else
			this._loadProjects();
	},
	
	_loadProjects: function()
	{
		var me = this;
		
		$.get('/project', function(d) {
			me._renderProjects(d.projects);
		});
	},
	
	_on_click: function(ev)
	{
		if (ev.currentTarget.dataset.path)
			ide.commands.project(ev.currentTarget.dataset.path);
		ev.preventDefault();
	},
	
	_renderProjects: function(projects)
	{
	var
		all = _.sortBy(projects, 'name')
	;
		this.addFiles(all);
	}
	
});

ide.plugins.register('welcome', new ide.Plugin({

	commands: {
		hello: function()
		{
			ide.notify('Hello, ' + ide.project.get('user'));
		},
		
		projects: function()
		{
			this.openProjects();
		}
	},
	
	openProjects: function()
	{
		ide.workspace.add(new ProjectList({ plugin: this }));
	},
	
	open: function(file)
	{
		if (file==='projects')
			this.openProjects();
	},

	start: function()
	{
	var
		p = ide.project,
		user = p.get('user'),
		project = p.get('name')
	;
		if (user)
			ide.alert('Welcome ' + user);
		
		if (project)
		{
			window.document.title = project;
			$('#subtitle').html(project);
		}
		
		$('#title > small').html(ide.version);
	}

}));

})(window.ide, this._, this.jQuery);
