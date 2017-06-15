/**
 * workspace.file
 */
(function(cxl, ide) {
"use strict";

var
	CONTENT_TYPE_REGEX = /([\w\d\/\-]+)(?:;\s*charset="?([\w\d\-]+)"?)?/
;

class File {

	constructor(filename, content)
	{
		this.filename = filename;
		this.originalContent = this.content = content || '';
		this.subscribers = [
			ide.plugins.on('socket.message.file', this.onMessage, this),
			ide.plugins.on('socket.ready', this.onSocketReady, this)
		];
	}

	onSocketReady()
	{
		if (this.id)
			ide.socket.send('file', { stat: { p: this.id } });
	}

	onSave()
	{
		this.outOfSync = false;
		ide.notify('File ' + this.id + ' saved.');
		ide.plugins.trigger('file.write', this);
	}

	isNew()
	{
		return !this.mtime;
	}

	$parse(xhr)
	{
		var m = CONTENT_TYPE_REGEX.exec(xhr.getResponseHeader('content-type'));

		this.mime = m[1];
		this.encoding = m[2];
		// TODO support other content types
		this.content = this.originalContent = this.mime==='text/directory' ?
			JSON.parse(xhr.responseText) : xhr.responseText;

		this.id = xhr.getResponseHeader('ws-file-id');
		this.mtime = +xhr.getResponseHeader('ws-file-mtime');
		this.$fetching = null;

		ide.plugins.trigger('file.parse', this);

		return this;
	}

	hasChanged()
	{
		return this.content !== this.originalContent;
	}

	// TODO see if we can remove this function
	setContent(content)
	{
		// TODO ? should we fire change and not parse?
		if (this.content!==content)
		{
			this.content = content;
			ide.plugins.trigger('file.parse', this);
		}
	}

	$onError(res)
	{
	var
		id = this.id || (ide.project.id + '/' + this.filename),
		msg = (res && (res.responseJSON && res.responseJSON.error) ||
			res.responseText) ||
			(this.saving ? 'Error saving file: ' : 'Error opening file: ') + id
	;
		ide.error(msg);
		this.$fetching = null;
		return Promise.reject(msg);
	}

	onMessageStat(data)
	{
		if (this.mtime!==data.t)
		{
			if (this.hasChanged())
			{
				this.outOfSync = true;
				ide.warn('File "' + this.id + '" contents could not be updated.');
			}
			else
			{
				if (!this.$fetching)
					ide.notify('File "' + data.f + '" was updated.');

				this.fetch();
			}
		}
	}

	onMessage(data)
	{
		if (data.stat && data.stat.p===this.id)
			this.onMessageStat(data.stat);
	}

	// TODO deprecate this function
	fetch()
	{
		var url = this.$url();

		if (this.$fetching)
			return this.$fetching;

		return (this.$fetching = cxl.ajax.xhr({ url: url })
			.then(this.$parse.bind(this), this.$onError.bind(this)));
	}

	delete()
	{
		var file = this;

		if (this.isNew())
			ide.notify('File does not exist');

		function onDelete()
		{
			ide.notify('File successfully deleted');
			return file.fetch();
		}

		return cxl.ajax.xhr({ url: this.$url(), method: 'DELETE' })
			.then(onDelete, this.$onError.bind(this));
	}

	read()
	{
		return this.$fetch();
	}

	isDirectory()
	{
		return this.mime === 'text/directory';
	}

	$writeError(msg)
	{
		ide.error(msg);
		return cxl.Promise.reject(msg);
	}

	write(filename, force)
	{
		if (this.isDirectory())
			return this.$writeError(File.ERROR_WRITE_DIRECTORY);

		if (filename && this.filename !== filename)
			this.filename = filename;

		if (!this.filename)
			return this.$writeError(File.ERROR_WRITE_NO_FILENAME);

		if (!force && this.outOfSync)
			return this.$writeError(File.ERROR_WRITE_OOS);

		return this.$save();
	}

	$save()
	{
		var url = this.$url();

		ide.plugins.trigger('file.beforewrite', this);

		return cxl.ajax.xhr({
			url: url,
			method: this.id ? 'PUT' : 'POST',
			contentType: 'application/octet-stream',
			data: this.content
		}).then(this.$parse.bind(this))
			.then(this.onSave.bind(this), this.$onError.bind(this));
	}

	$url()
	{
		// TODO remove this and use etag
		var mtime = this.mtime || '';

		return '/file?p=' + encodeURIComponent(ide.project.id) +
			'&n=' + encodeURIComponent(this.filename) + '&t=' + mtime;
	}

	diff()
	{
	var
		old = this.originalContent,
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

	/**
	 * Serialize file to be read by sockets
	 */
	toSocket()
	{
		return {
			id: this.id,
			diff: this.diff()
		};
	}

	destroy()
	{
		this.subscribers[0].unsubscribe();
		this.subscribers[1].unsubscribe();
	}

}

File.ERROR_WRITE_DIRECTORY = 'Cannot write to directory';
File.ERROR_WRITE_OOS = 'File contents have changed';
File.ERROR_WRITE_NO_FILENAME = 'No file name' ;

// TODO should we allow events for files?
// Object.assign(File.prototype, cxl.Events);

/**
 * Editor with ide.File support
 */
class FileEditor extends ide.Editor {

	quit(force)
	{
		if (!force && this.file.hasChanged())
			return 'File has changed. Are you sure?';

		super.quit(force);
	}

}

class FileEditorHeader extends ide.feature.EditorHeader {

	render()
	{
		var update = this.update.bind(this);
		super.render();
		this.editor.listenTo(ide.plugins, 'file.parse', update);
		update();
	}

	getTitle()
	{
	var
		plugin = this.editor.plugin && this.editor.plugin.name,
		filename = this.editor.file.filename || 'No Name'
	;
		return (plugin ? plugin + ':' : '') + filename;
	}

	update()
	{
	var
		changed = this.editor.file.hasChanged(),
		title = this.getTitle()
	;
		this.changed = changed;
		this.title = title;

		if (this.editor.file.outOfSync)
			this.setTag('file.old',
				'<span title="File contents have changed">Out of Sync</span>', 'error');

		this.setTag('file.new', this.editor.file.isNew() ? 'New' : null);
	}

}

FileEditor.features(ide.feature.FileFeature, FileEditorHeader, ide.feature.FileHashFeature);

var fileItem = new ide.DynamicItem({ code: 'file' });

function getTags(file)
{
var
	tags = []
;
	if (file.content && file.content.indexOf)
		tags.push(file.content.indexOf("\r\n")!==-1 ? 'CRLF' : 'LF');

	if (file.isDirectory())
		tags.push('directory');
	else if (file.mime)
		tags.push(file.mime);

	return tags;
}

ide.plugins.on('assist', function(done, editor) {

	var file = editor && editor.file;

	if (!file)
		return;

	if (!fileItem.el)
		ide.assist.addPermanentItem(fileItem);

	if (fileItem.file !== file)
	{
		fileItem.file = file;
		fileItem.title = file.filename;
		fileItem.tags = getTags(file);
	}

	if (file.outOfSync)
		done({ title: 'File contents have changed', code: 'file', className: 'error' });

});

ide.File = File;
ide.FileEditor = FileEditor;

})(this.cxl, this.ide, this._);
