
(function(ide, _, $, cxl) {
"use strict";
	
var ProjectList = ide.Editor.List.extend({
	
	title: 'projects',
	
	_setup: function()
	{
		ide.Editor.List.prototype._setup.call(this);
		
		this.itemTemplate = cxl._templateId('tpl-project');
	},
	
	_ready: function()
	{
		ide.Editor.List.prototype._ready.call(this);
		this._loadProjects();
	},
	
	_loadProjects: function()
	{
		var me = this;
		
		$.get('/projects', function(d) {
			me._renderProjects(d);
		});
	},
	
	onItemClick: function(ev, item)
	{
		// TODO umm ugly
		if (ev.target.parentNode.tagName==='A')
			return ev.stopPropagation();
		
		if (item.path)
		{
			ide.commands.project(item.path);
			ev.preventDefault();
		}
	},
	
	_renderProjects: function(projects)
	{
	var
		all = _.sortBy(projects, 'name')
	;
		this.add(all);
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
			this.openProjects({ plugin: this, params: 'projects' });
		}
	},
	
	openProjects: function(options)
	{
		ide.workspace.add(new ProjectList(options));
	},
	
	open: function(options)
	{
		if (options.params==='projects')
			return new ProjectList(options);
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
		
		ide.plugins.on('workspace.add', this.onChange, this);
		ide.plugins.on('workspace.remove', this.onChange, this);
	},

	start: function()
	{
	var
		p = ide.project,
		user = p.get('user'),
		project = this.project = p.get('name') || p.get('path')
	;
		if (user)
			ide.alert('Welcome ' + user);
		
		if (project)
			window.document.title = project;
		
		window.setTimeout(this.onTimeout.bind(this));
	}

}));

})(window.ide, this._, this.jQuery, this.cxl);
