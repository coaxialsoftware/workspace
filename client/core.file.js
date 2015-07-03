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
		ide.plugins.trigger('file.write', this);
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
		ide.plugins.trigger('file.beforewrite', this);
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

	
ide.plugins.register('file', {
	
	commands: {
		
		/**
		 * Edits file with registered plugins.
		 * @param {string} ... Files to open.
		 */
		edit: function()
		{
			if (arguments.length)
				for (var i=0; i<arguments.length; i++)
					ide.open(arguments[i]);
			else
				ide.open();
		},

		e: 'edit',
		
		tabe: function(name)
		{
			ide.open_tab(name, '_blank');
		},

		/**
		 * Insert the file [file] (default: current file) below the cursor.
		 */
		read: function(file)
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
		},

		r: 'read'
	},
	
	onMessageStat: function(data)
	{
		var file = ide.fileManager.findFile(data.p);
		
		if (file && file.get('mtime')!==data.t)
		{
			ide.notify('File ' + file.get('filename') + ' was updated.');
			file.fetch();
		}
	},
	
	onMessage: function(data)
	{
		if (data.stat)
			this.onMessageStat(data.stat);
	},
	
	ready: function()
	{
		ide.plugins.on('socket.message.file', this.onMessage, this);
	}
	
});

})(this.cxl, this.ide, this.jQuery);
