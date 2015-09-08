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
		
		ide.plugins.on('socket.message.project', this.onMessage, this);
	},

	on_error: function()
	{
		ide.error('Error loading Project: ' + this.id);
	},

	/**
	 * Open a file
	 */
	open: function(filename, callback)
	{
	var
		file = new ide.File({
			project: this.get('path'),
			filename: filename || ''
		})
	;
		return file.fetch({ success: callback });
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
		
		return data;
	},
	
	onMessage: function(msg)
	{
		var diff;
		
		if (!msg) return;
		
		if (msg.reload===true)
			this.fetch();
		else
		{
			diff = ide.diff(this.attributes, msg);

			if (diff)
				this.set(this.parse(diff));
		}
	},

	on_project: function()
	{
		ide.plugins.trigger('project.load', this);
		ide.socket.send('project', this.attributes);
	},
	
	set_files: function(files)
	{
		this.attributes.files = files;
		this.files_json = files && JSON.parse(files);
		this.files_text = files ? _.pluck(this.files_json,
			'filename').join("\n").replace(/ /g, '\\ ') : '';
	}

});
	
/**
 * Open project by path
 */
ide.registerCommand('project', function(name) {
	window.open('#' + ide.workspace.hash.encode({ p: name || null, f: null }));
});
	


})(this.cxl, this.ide, this._);
