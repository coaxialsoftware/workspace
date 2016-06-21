/**
 * workspace.project
 */

(function(cxl, ide, _) {
"use strict";

ide.Project = cxl.Model.extend({

	idAttribute: 'path',

	url: function()
	{
		return '/project' + (this.id ? '?n=' + this.id : '');
	},
	
	initialize: function()
	{		
		this.on('sync', this.on_project);
		this.on('error', this.on_error);
		this.reload = _.debounce(this.fetch.bind(this), 500);
		
		ide.plugins.on('socket.message.project', this.onMessage, this);
	},

	on_error: function()
	{
		ide.error('Error loading Project: ' + this.id);
	},

	loadTheme: function(css)
	{
		if (this.themeEl)
			cxl.$body[0].removeChild(this.themeEl);
		
		this.themeEl = document.createElement('STYLE');
		this.themeEl.innerHTML = css;
		cxl.$body.append(this.themeEl);
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
			this.reload();
		
		if (msg.notify)
			ide.notify(msg.notify);
	},

	on_project: function()
	{
		this.hint.icons = this.get('icons');
		ide.plugins.trigger('project.load', this);
	},
	
	set_files: function(files)
	{
		this.attributes.files = files;
		files.forEach(function(f) {
			f.hint = new ide.Hint({
				title: f.filename, icon: f.directory ? 'folder-o' : 'file-o'
			});
		});
	}

});
	
	
ide.plugins.on('assist', function(done) {
	if (ide.project.id)
		done(ide.project.hint);
});
	
/**
 * Open project by path
 */
ide.registerCommand('project', function(name) {
	var hash = '#' + ide.workspace.hash.encode({ p: name || null, f: null });
	if (ide.project.id || ide.workspace.slots.length)
		window.open(hash);
	else
	{
		window.location = hash;
		window.location.reload();
	}
});
	


})(this.cxl, this.ide, this._);
