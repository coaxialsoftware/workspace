/**
 * workspace.file
 */

(function(cxl, ide) {
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
		this.saving = false;
	},

	_onError: function(file, res)
	{
	var
		id = this.id || (this.get('project') + '/' + this.get('filename')),
		msg = (res && (res.responseJSON && res.responseJSON.error) ||
			res.responseText) || 
			(this.saving ? 'Error saving file: ' : 'Error opening file: ') + id
	;
		this.saving = false;
		ide.error(msg);
	},

	save: function()
	{
		this.saving = true;
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
	}
	
});
	
function FileManager()
{
	ide.plugins.on('socket.message.file', this.onMessage, this);
}
	
FileManager.prototype = {
	
	each: function(callback)
	{
		var result;
		
		ide.workspace.each(function(editor) {
			if (editor && editor.file)
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
	
	onMessageStat: function(data)
	{
		var file = this.findFile(data.p);
		
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
			
			file = this.findFile(this.getPath(filename)) ||
				new ide.File(filename);
		} 
		
		return file || new ide.File();
	}
	
};
	
ide.plugins.on('assist', function(done, editor, token) {
	
	if (editor && editor.file)
	{
		var hints = [];
		
		if (editor.file instanceof ide.File)
			hints.push({ title: editor.file.get('filename'), tags: [ 'file' ] });
		
		if (token && (token.type===null || token.type==='string' ||
			token.type==='string property') && token.string)
			hints.push({ title: 'Find file ' + token.string, code: 'find'
			});
		
		done(hints);
	}
	
});
	
ide.fileManager = new FileManager();

})(this.cxl, this.ide);
