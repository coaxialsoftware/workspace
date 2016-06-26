/**
 * workspace.file
 */

(function(cxl, ide, _) {
"use strict";

ide.File = cxl.Model.extend({

	idAttribute: 'path',
	originalValue: '',
	version: 0,

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
	},

	parse: function(data)
	{
		this.originalValue = data.content || '';
		
		var separator = this.originalValue.indexOf("\r\n")!==-1 ? 'CRLF' : 'LF';
			
		this.hint = { code: 'file', tags: [ separator ] };
		return data;
	},

	diff: function()
	{
	var
		cur = this.attributes.content,
		old = this.originalValue,
		changed = this.diffChanged = this.diffValue !== cur
	;
		if (changed)
		{
			this.diffValue = cur;
			return (this.lastDiff = ide.diff(old, cur));
		} else
			return this.lastDiff;
	}

});

function FileManager()
{
	ide.plugins.on('socket.message.file', this.onMessage, this);
}

FileManager.prototype = {

	findFiles: function(filename)
	{
		return _.filter(ide.workspace.slots, [ 'editor.file.attributes.filename', filename ]);
	},

	onMessageStat: function(data)
	{
		var files = this.findFiles(data.f), updated=0;

		// TODO optimize this?
		files.forEach(function(slot) {

			var file = slot.editor.file;

			if (file.get('mtime')!==data.t)
			{
				if (file.hasChanged('content'))
				{
					file.old = true;
					ide.warn('File "' + file.id + '" contents could not be updated.');
				}
				else
				{

					updated++;
					file.fetch();
				}
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
	
ide.plugins.on('assist', function(done, editor) {

	if (editor && editor.file)
	{
		if (editor.file instanceof ide.File)
		{
			var hint = editor.file.hint;
			hint.title = editor.getInfo();
			done(hint);
		}
	}

});

ide.fileManager = new FileManager();

})(this.cxl, this.ide, this._);
