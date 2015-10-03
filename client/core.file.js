/**
 * workspace.file
 */

(function(cxl, ide) {
"use strict";

ide.File = cxl.Model.extend({

	idAttribute: 'path',

	initialize: function()
	{
		this.attributes.project = ide.project.get('path');
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
		id = this.id || (this.get('project') + '/' + this.get('filename')),
		msg = (res && (res.responseJSON && res.responseJSON.error) ||
			res.responseText) || 
			(this.saving ? 'Error saving file: ' : 'Error opening file: ') + id
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

	url: function()
	{
	var
		mtime = Date.now()
	;
		return '/file?p=' + this.get('project') +
			'&n=' + this.get('filename') + '&t=' + mtime;
	}
	
});
	
function FileManager()
{
	this.files = {};
	ide.plugins.on('socket.message.file', this.onMessage, this);
}
	
FileManager.prototype = {
	
	// TODO garbage collect files...
	files: null,
	
	findFile: function(path)
	{
		return this.files[path];
	},
	
	onMessageStat: function(data)
	{
		var file = this.findFile(data.f);
		
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
	
	/**
	 * Creates a new file object if it is already open returns 
	 * that instance instead.
	 */
	getFile: function(filename)
	{
		var file;

		if (filename)
		{	
			if (typeof(filename)==='string')
				filename = { filename: filename };
			
			file = this.findFile(filename.filename);

			if (!file)
				file = this.files[filename.filename] = new ide.File(filename);
		} 
		
		return file || new ide.File();
	}
	
};
	
ide.plugins.on('assist', function(done, editor, token) {
	
	if (editor && editor.file)
	{
		var hints = [];
		
		if (editor.file instanceof ide.File)
			hints.push({ title: editor.file.get('filename'), code: 'file' });
		
		if (token && (token.type===null || token.type==='string' ||
			token.type==='string property') && token.string)
			hints.push({ title: 'Find file ' + token.string, action: 'find'
			});
		
		done(hints);
	}
	
});
	
ide.fileManager = new FileManager();

})(this.cxl, this.ide);
