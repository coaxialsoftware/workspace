/**
 * workspace.project
 */

(function(cxl, ide) {
"use strict";

ide.Project = cxl.Model.extend({

	idAttribute: 'path',

	url: function()
	{
		return '/project' + (this.id ? '?n=' + this.id : '');
	},

	initialize: function()
	{
		this.on('sync', this.onProject, this);
		this.reload = cxl.debounce(this.fetch.bind(this), 500);

		ide.plugins.on('socket.message.project', this.onMessage, this);
	},

	loadTheme: function(css)
	{
		var body = document.body;

		if (this.themeEl)
			body.removeChild(this.themeEl);

		this.themeEl = document.createElement('STYLE');
		this.themeEl.innerHTML = css;
		body.appendChild(this.themeEl);
	},

	parse: function(data)
	{
		if (data.files)
			this.set_files(data.files);
		if (data['ignore.regex'])
			this.ignoreRegex = new RegExp(data['ignore.regex']);
		if (data['theme.css'])
			this.loadTheme(data['theme.css']);

		this.hint = new ide.Item({
			priority: 0,
			code: 'project',
			title: data.name || data.path,
			tags: data.tags
		});

		return data;
	},

	onMessage: function(msg)
	{
		if (!msg) return;

		if (msg.reload===true)
		{
			ide.notify({
				code: 'project', title: 'Project configuration was updated. Reloading.',
				className: 'warn'
			});
			this.reload();
		}

		if (msg.notify)
			ide.notify(msg.notify);
	},

	onProject: function()
	{
		this.hint.icons = this.get('icons');
		ide.plugins.trigger('project.load', this);
	},

	set_files: function(files)
	{
		this.attributes.files = files;
		files.forEach(function(f) {
			Object.defineProperty(f, 'hint', {
				value: new ide.Item({
					title: f.filename, icon: f.icon || (f.directory ? 'folder-o' : 'file-o')
				})
			});
		});
	}

});

ide.plugins.on('assist', function(done) {
	if (ide.project.id!=='.')
		done(ide.project.hint);
});

ide.plugins.on('socket.ready', function() {
	ide.project.reload();
});

/**
 * Open project by path
 */
ide.registerCommand('project', {
	fn: function(name) {
		var hash = '#' + ide.hash.encode({ p: name || null, f: null });
		if (ide.project.id!=='.' || ide.workspace.slots.length)
			window.open(hash);
		else
		{
			window.location = hash;
			window.location.reload();
		}
	},
	args: [ 'project' ],
	description: 'Load project'
});

ide.registerCommand('project.settings', {
	fn: function() {
		ide.open({ file: 'project.json' });
	},
	icon: 'cog'
});



})(this.cxl, this.ide);
