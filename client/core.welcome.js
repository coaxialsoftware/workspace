
(function(ide, cxl) {
"use strict";

class ProjectList extends ide.ListEditor { 

	render()
	{
		this.title = this.command = 'projects';
		super.render();
		this._loadProjects();
	}

	_loadProjects()
	{
		cxl.ajax.get('/projects').then(this._renderProjects.bind(this));
	}

	onItemClick(ev, item)
	{
		if (item.path)
		{
			ide.commands.project(item.path);
			ev.preventDefault();
		}
	}

	_renderProjects(projects)
	{
	var
		all = cxl.sortBy(Object.values(projects), 'name')
	;
		this.add(all.map(function(p) {
			return new ide.Item({
				title: p.name || p.path,
				tags: p.tags,
				description: p.description,
				icons: p.icons
			});
		}));
	}

}

ide.plugins.register('welcome', new ide.Plugin({

	commands: {
		hello: function()
		{
			ide.notify('Hello, ' + ide.project.get('user'));
		},

		projects: function()
		{
			ide.workspace.add(new ProjectList({ plugin: this }));
		}
	},

	open: function(options)
	{
		if (options.file==='projects')
			return new ProjectList(options);
	},

	onChange: function()
	{
		if (ide.workspace.editors.length===0)
		{
			this.$el.style.display='block';
			this.$el.style.opacity=1;
		}
		else
		{
			this.$el.style.display='none';
			this.$el.style.opacity=0;
		}
	},
	
	renderTemplate: function()
	{
		return '<h1 id="title">workspace<small> ' + ide.version + '</small></h1>' +
			'<p>Type <kbd>' + this.exKey + '</kbd> to enter commands or <kbd>' + 
			this.assistKey + '</kbd> for the assist window.</p><h2 id="subtitle">' +
			this.project + '</h2>';
	},

	ready: function()
	{
	var
		p = ide.project,
		user = p.get('user'),
		project = this.project = p.get('name') || p.get('path')
	;
		if (user)
			ide.warn('Welcome ' + user);

		if (project)
			window.document.title = project;
		
		this.exKey = ide.keyboard.findKey('ex');
		this.assistKey = ide.keyboard.findKey('assist');

		this.$el = document.getElementById('welcome');
		this.$el.innerHTML = this.renderTemplate();
		this.onChange();

		ide.plugins.on('workspace.add', this.onChange, this);
		ide.plugins.on('workspace.remove', this.onChange, this);
	}

}));

})(this.ide, this.cxl);
