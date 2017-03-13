/**
 * workspace.file
 */

(function(cxl, ide) {
"use strict";

class File {

	constructor(filename)
	{
		this.filename = filename;
		this.content = '';
		this.attributes = { content: '' };
		this._createHint();
	}

	onSave()
	{
		this.old = false;
		ide.plugins.trigger('file.write', this);
	}
	
	_createHint()
	{
	var
		separator = this.content.indexOf("\r\n")!==-1 ? 'CRLF' : 'LF',
		tags = [ separator ]
	;
		if (this.mime)
			tags.push(this.mime);
		
		this.hint = new ide.Hint({
			code: 'file', title: this.filename, tags: tags
		});
	}
	
	parse(data)
	{
		this.attributes = data;
		// Get normalized path
		this.filename = data.filename;
		this.mime = data.mime;
		this.content = this.originalContent = data.content;
		this.id = data.path;
		
		this._createHint();
		
		return this;
	}
	
	hasChanged()
	{
		return this.content !== this.attributes.content;
	}

	onError(res)
	{
	var
		id = this.id || (this.attributes.project + '/' + this.filename),
		msg = (res && (res.responseJSON && res.responseJSON.error) ||
			res.responseText) ||
			(this.saving ? 'Error saving file: ' : 'Error opening file: ') + id
	;
		ide.error(msg);
		return Promise.reject(msg);
	}
	
	fetch()
	{
		var url = this.url();
		
		return cxl.ajax({ url: url }).then(this.parse.bind(this), this.onError.bind(this));
	}

	save()
	{
		var url = this.url();
		
		ide.plugins.trigger('file.beforewrite', this);
		
		return cxl.ajax({
			url: url,
			method: this.id ? 'PUT' : 'POST',
			data: this.attributes
		}).then(this.parse.bind(this)).then(this.onSave.bind(this), this.onError.bind(this));
	}

	url()
	{
		var mtime = Date.now();
		
		return '/file?p=' + encodeURIComponent(ide.project.id) + 
			'&n=' + encodeURIComponent(this.filename) + '&t=' + mtime;
	}
	
	diff()
	{
	var
		old = this.attributes.content,
		cur = this.content,
		changed = this.diffChanged = this.diffValue !== cur
	;
		if (changed)
		{
			this.diffValue = cur;
			return (this.lastDiff = ide.diff(old, cur));
		} else
			return this.lastDiff;
	}

}

class FileManager {
	
	constructor() {
		ide.plugins.on('socket.message.file', this.onMessage, this);
	}

	findFiles(filename)
	{
		return ide.workspace.editors.filter(function(editor) {
			return editor.file && editor.file.filename===filename;
		});
	}

	onMessageStat(data)
	{
		var files = this.findFiles(data.f), updated=0;

		// TODO optimize this?
		files.forEach(function(editor) {

			var file = editor.file;

			if (file.attributes.mtime!==data.t)
			{
				if (file.hasChanged())
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
	}

	onMessage(data)
	{
		if (data.stat)
			this.onMessageStat(data.stat);
	}

	/**
	 * Creates a new file object.
	 */
	getFile(filename)
	{
		return new ide.File(filename);
	}

}
	
Object.assign(File.prototype, cxl.Events);
	
ide.plugins.on('assist', function(done, editor) {

	if (editor && editor.file)
	{
		if (editor.file instanceof ide.File)
			done(editor.file.hint);
	}

});

ide.File = File;
ide.fileManager = new FileManager();

})(this.cxl, this.ide, this._);
