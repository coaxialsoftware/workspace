
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
		// TODO umm ugly
		if (ev.target.parentNode.tagName==='A')
			return ev.stopPropagation();
		
		this.focus();
		
		if (ev.currentTarget.dataset.path)
		{
			ide.commands.project(ev.currentTarget.dataset.path);
			ev.preventDefault();
		}
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
	
	onChange: function()
	{
		if (ide.workspace.slots.length===0)
			this.$el.show().css('opacity', 1);
		else
			this.$el.hide().css('opacity', 0);
	},
	
	onTimeout: function()
	{
		this.exKey = ide.keyboard.findKey('ex');
		this.assistKey = ide.keyboard.findKey('assist');
		
		this.template = _.template($('#tpl-welcome').html())(this);
		this.$el = $('#welcome').html(this.template);
		this.onChange();
		
		ide.plugins.on('workspace.add_child', this.onChange, this);
		ide.plugins.on('workspace.remove_child', this.onChange, this);
	},

	start: function()
	{
	var
		p = ide.project,
		user = p.get('user'),
		project = this.project = p.get('name')
	;
		if (user)
			ide.alert('Welcome ' + user);
		
		if (project)
			window.document.title = project;
		
		window.setTimeout(this.onTimeout.bind(this));
	}

}));

})(window.ide, this._, this.jQuery);
