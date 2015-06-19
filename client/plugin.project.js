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

	on_project: function()
	{
		this.files_text = ''; //this.get('files').join("\n");
		this.trigger('load');
	}

});

ide.plugins.register('project', {

	onMessage: function(msg)
	{
		if (msg.files)
		{
			ide.project.set('files', msg.files);
			ide.project.files_text = msg.files.join("\n");
		}
	},

	ready: function()
	{
		var socket = ide.plugins.get('socket');

		socket.on('message.project', this.onMessage, this);
	}

});

})(this.cxl, this.ide);
