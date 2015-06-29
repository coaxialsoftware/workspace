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
		this.files_text = files ? _.pluck(files, 'filename').join("\n") : '';
	}

});

ide.plugins.register('project', {

	onMessage: function(msg)
	{
		if (!msg) return;

		if (msg.files)
			ide.project.set_files(msg.files);
	},

	ready: function()
	{
		ide.plugins.on('socket.message.project', this.onMessage, this);
		ide.socket.send('project', ide.project.attributes);
	}

});

})(this.cxl, this.ide, this._);
