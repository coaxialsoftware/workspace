/**
 * workspace.file
 */

(function(cxl, ide, $) {
"use strict";

ide.File = cxl.Model.extend({

	idAttribute: 'path',

	initialize: function()
	{
		this.set('project', ide.project.get('path'));
		this.on('error', this._onError);
	},

	_onSync: function()
	{
		this.trigger('write');
		ide.trigger('file.write', this);
		ide.notify('File ' + this.id + ' saved.');
	},

	_onError: function(file, res)
	{
	var
		msg = (res && (res.responseJSON && res.responseJSON.error) ||
			res.responseText) || 'Error saving file: ' + this.id
	;
		ide.error(msg);
	},

	save: function()
	{
		ide.trigger('beforewrite', this);
		cxl.Model.prototype.save.call(this, null, {
			success: this._onSync.bind(this)
		});
	},

	isNew: function()
	{
		return this.attributes.new;
	},

	url: function()
	{
	var
		mtime = Date.now()
	;
		return '/file?p=' + this.get('project') +
			'&n=' + this.get('filename') + '&t=' + mtime;
	},

	toString: function()
	{
		return this.get('filename') || '';
	}

});
	
ide.fileManager = {
	
	each: function(callback)
	{
		var result;
		
		ide.workspace.each(function(editor) {
			if (editor.file)
			{
				result = callback(editor.file);
				if (result) return false;
			}
		});
		
		return result;
	},
	
	getPath: function(filename)
	{
		return ide.project.id + cxl.path(filename);
	},
	
	findFile: function(path)
	{
		return this.each(function(file) {
			if (file.id===path)
				return file;
		});
	},
	
	/**
	 * Creates a new file object if it is already open returns 
	 * that instance instead.
	 */
	getFile: function(filename)
	{
		var file;
		
		if (filename)
		{
			file = this.findFile(this.getPath(filename)) ||
				new ide.File({
					filename: filename
				});
		} 
		
		return file || new ide.File();
	}
	
};

/**
 * Insert the file [file] (default: current file) below the cursor.
 */
ide.commands.read = function(file)
{
	if (ide.editor && ide.editor.insert)
	{
		file = file || ide.editor.file.get('filename');

		$.get('/file?p=' + ide.project.id + '&n=' + file)
			.then(function(content) {
				if (content.new)
					ide.notify('File does not exist.');
				else
					ide.editor.insert(content.content.toString());
			}, function(err) {
				ide.error(err);
			});
	} else
		ide.error('Current editor does not support command.');
};

ide.commands.r = 'read';
	
ide.plugins.register('file', {
	
	onMessage: function(data)
	{
		var file = ide.fileManager.findFile(data.path);
		
		if (file)
		{
			ide.notify('File ' + file.get('filename') + ' was updated.');
			file.set(data);
		}
	},
	
	onWindowFocus: function()
	{
		ide.fileManager.each(function(file) {
			if (file.id)
				ide.socket.send('file', {
					stat: { p: file.id, t: file.get('mtime') }
				});
		});
	},
	
	ready: function()
	{
		cxl.$window.focus(this.onWindowFocus.bind(this));
		ide.plugins.on('socket.message.file', this.onMessage);
	}
	
});

})(this.cxl, this.ide, this.jQuery);