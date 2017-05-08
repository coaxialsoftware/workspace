
(function(ide, cxl) {
"use strict";
	
class ProjectList extends ide.ListEditor { 

	render(p)
	{
		p.title = this.command = 'projects';
		super.render(p);
		this._loadProjects();
	}

	_loadProjects()
	{
		cxl.ajax.get('/projects').then(this._renderProjects.bind(this));
	}

	_renderProjects(projects)
	{
	var
		all = Object.values(projects).map(function(p) {
			return new ide.Item({
				title: p.name || p.path,
				tags: p.tags,
				description: p.description,
				icons: p.icons,
				enter: function()
				{
					ide.run('project', [p.path]);
				}
			});
		})
	;
		this.add(cxl.sortBy(all, 'title'));
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
			return new ProjectList({ plugin: this });
		}
	},
	
	onChange: function()
	{
		if (ide.workspace.slots.length===0)
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
