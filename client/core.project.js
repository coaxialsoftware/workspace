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

	parse: function(data)
	{
		if (data.files)
			this.set_files(data.files);
		
		return data;
	},

	on_project: function()
	{
		this.trigger('load');
	},
	
	set_files: function(files)
	{
		this.attributes.files = files;
		this.files_json = files && JSON.parse(files);
		this.files_text = files ? _.pluck(this.files_json,
			'filename').join("\n") : '';
	}

});

ide.plugins.register('project', {
	
	commands: {
		
		/**
		 * Open project by path
		 */
		project: function(name)
		{
			window.open('#' + ide.workspace.hash.encode({ p: name || null, f: null }));
		}
		
	},

	onMessage: function(msg)
	{
		if (!msg) return;
		
		var diff = ide.diff(ide.project.attributes, msg);
		
		if (diff)
			ide.project.set(ide.project.parse(diff));
	},

	ready: function()
	{
		ide.plugins.on('socket.message.project', this.onMessage, this);
		ide.socket.send('project', ide.project.attributes);
	}

});

})(this.cxl, this.ide, this._);
