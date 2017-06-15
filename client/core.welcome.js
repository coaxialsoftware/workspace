
(function(ide) {
"use strict";

ide.plugins.register('welcome', new ide.Plugin({

	core: true,

	commands: {
		hello: function()
		{
			ide.notify('Hello, ' + ide.project.get('user'));
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
		project = this.project = p.get('name') || p.get('path')
	;
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

})(this.ide);
