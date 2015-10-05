/**
 * workspace.file
 */

(function(cxl, ide, _) {
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
		this.old = false;
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
	ide.plugins.on('socket.message.file', this.onMessage, this);
}
	
FileManager.prototype = {
	
	findFiles: function(filename)
	{
		return _.filter(ide.workspace.slots, 'editor.file.attributes.filename', filename);
	},
	
	onMessageStat: function(data)
	{
		var files = this.findFiles(data.f), updated=0;
		
		// TODO optimize this?
		files.forEach(function(slot) {
			
			var file = slot.editor.file;
			
			if (file.hasChanged('content'))
			{
				file.old = true;
				ide.warn('File "' + this.file.id + '" contents could not be updated.');
			}
			else if (file.get('mtime')!==data.t)
			{
				updated++;
				file.fetch();
			}
		});
		
		if (updated)
			ide.notify('File "' + data.f + '" was updated.');
	},
	
	onMessage: function(data)
	{
		if (data.stat)
			this.onMessageStat(data.stat);
	},
	
	/**
	 * Creates a new file object.
	 */
	getFile: function(filename)
	{
		if (typeof(filename)==='string')
			filename = { filename: filename };
		
		return new ide.File(filename);
	}
	
};
	
ide.plugins.on('assist', function(done, editor, token) {
	
	if (editor && editor.file)
	{
		var hints = [];
		
		if (editor.file instanceof ide.File)
			hints.push({ title: editor.getInfo(), code: 'file' });
		
		if (token && (token.type===null || token.type==='string' ||
			token.type==='string property') && token.string)
			hints.push({ title: 'Find file ' + token.string, action: 'find'
			});
		
		done(hints);
	}
	
});
	
ide.fileManager = new FileManager();

})(this.cxl, this.ide, this._);
