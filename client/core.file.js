/**
 * workspace.file
 */
(function(cxl, ide) {
"use strict";

var
	CONTENT_TYPE_REGEX = /([\w\d\/\-]+)(?:;\s*charset="?([\w\d\-]+)"?)?/
;

class File {

	static joinPath()
	{
		return Array.prototype.join.call(arguments, ide.project.get('path.separator'));
	}

	// TODO
	static getIcon(mime)
	{
		return mime==='text/directory' ? 'directory' : 'file';
	}

	/**
	 * @param name File name relative to project.
	 */
	constructor(name)
	{
		this.name = name;
		this.stat = {};
	}

	$url()
	{
	var
		// TODO remove this and use etag
		mtime = this.stat && this.stat.mtime ? '&t=' + this.stat.mtime.getTime() : ''
	;
		return '/file?p=' + encodeURIComponent(ide.project.id) + '&n=' +
			encodeURIComponent(this.name) + mtime;
	}

	$parseStat(stat)
	{
		stat.atime = stat.atime && new Date(stat.atime);
		stat.mtime = stat.mtime && new Date(stat.mtime);
		stat.ctime = stat.ctime && new Date(stat.ctime);

		return stat;
	}

	decode(arraybuffer, encoding)
	{
		if (this.mime==='text/directory')
			return JSON.parse((new TextDecoder('utf8')).decode(arraybuffer));
		else
			return encoding && arraybuffer ?
				(new TextDecoder(encoding)).decode(arraybuffer) :
				arraybuffer;
	}

	$parse(xhr)
	{
		var m = CONTENT_TYPE_REGEX.exec(xhr.getResponseHeader('content-type'));

		this.mime = m[1];
		this.content = this.decode(xhr.response, this.encoding);
		this.path = xhr.getResponseHeader('ws-file-path');
		this.stat = this.$parseStat(JSON.parse(xhr.getResponseHeader('ws-file-stat')));
		this.name = xhr.getResponseHeader('ws-file-name');

		this.$fetching = null;

		ide.plugins.trigger('file.parse', this);

		return this;
	}

	$onError(res)
	{
	var
		id = this.id || (ide.project.id + '/' + this.name),
		msg = this.decode(res, 'utf8') ||
			(this.saving ? 'Error saving file: ' : 'Error opening file: ') + id
	;
		ide.error(msg);
		this.$fetching = null;
		return Promise.reject(msg);
	}

	/**
	 * Reads file with optional encoding. If encoding not passed it will return an ArrayBuffer
	 */
	read(encoding)
	{
		var url = this.$url();

		if (encoding)
			this.encoding = encoding;

		if (this.$fetching)
			return this.$fetching;

		return (this.$fetching = cxl.ajax.xhr({ url: url, responseType: 'arraybuffer' })
			.then(this.$parse.bind(this)).catch(this.$onError.bind(this)));
	}

	delete()
	{
		return cxl.ajax.xhr({ url: this.$url(), method: 'DELETE' })
			.then(() => this.read()).catch(this.$onError.bind(this));
	}

	$writeError(msg)
	{
		ide.error(msg);
		return cxl.Promise.reject(msg);
	}

	write(content)
	{
		if (this.stat && this.stat.isDirectory)
			return this.$writeError(File.ERROR_WRITE_DIRECTORY);

		if (!this.name)
			return this.$writeError(File.ERROR_WRITE_NO_FILENAME);

		var url = this.$url();

		return cxl.ajax.xhr({
			url: url,
			method: this.id ? 'PUT' : 'POST',
			contentType: 'application/octet-stream',
			dataType: 'arraybuffer',
			responseType: 'arraybuffer',
			data: content
		}).then(this.$parse.bind(this)).catch(this.$onError.bind(this));
	}
}

File.ERROR_WRITE_DIRECTORY = 'Cannot write to directory';
File.ERROR_WRITE_OOS = 'File contents have changed';
File.ERROR_WRITE_NO_FILENAME = 'No file name' ;

class FileItem extends ide.Item {

	constructor(p)
	{
		if (!p.icon)
			p.icon = File.getIcon(p.mime);

		super(p);

		this.prefix = p.prefix;
	}

	enter(shift, mod, editor)
	{
	var
		item = this,
		title = item.value || item.title,
		options = {
			file: (this.prefix ? this.prefix+ ide.project.get('path.separator') : '') + title,
			focus: !shift
		}
	;
		if (item.line)
			options.line = item.line;

		if (mod)
			options.target = '_blank';

		ide.open(options);

		if (!shift)
			ide.workspace.remove(editor);
	}

}

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
		filename = this.editor.file.name || 'No Name'
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

		if (this.editor.file.$sync.outOfSync)
			this.setTag('file.old',
				'<span title="File contents have changed">Out of Sync</span>', 'error');

		this.setTag('file.new', this.editor.file.stat.isNew ? 'New' : null, 'success');

		this.setTag('file.encoding',
			this.editor.file.encoding !== ide.project.get('editor.encoding') ?
				this.editor.file.encoding : null
		);
	}

}

class FileHashFeature extends ide.feature.HashFeature {

	render()
	{
		// Update hash on file.parse in case file name changes.
		this.editor.listenTo(ide.plugins, 'file.parse', function() {
			ide.workspace.update();
		});
	}

	get()
	{
	var
		editor = this.editor,
		cmd = editor.command || '',
		args = editor.arguments ? this.serializeArgs(editor.arguments) :
			(editor.file.name || '')
	;
		return (cmd ? cmd+':' : '') + args;
	}

}

/**
 * Keeps file in sync. Will do a read if the file has changed.
 */
class FileSync {

	constructor(file)
	{
		this.$file = file;
		this.$bindings = [
			ide.plugins.on('socket.message.file', this.$onMessage.bind(this)),
			ide.plugins.on('socket.ready', this.$onSocketReady.bind(this))
		];
	}

	$onSocketReady()
	{
		if (this.$file.path)
			ide.socket.send('file', { stat: { p: this.$file.path } });
	}

	$onMessageStat(data)
	{
		if (this.$file.stat && this.$file.stat.mtime.getTime()!==data.t)
		{
			if (this.$file.hasChanged())
			{
				this.outOfSync = true;
				ide.warn('File "' + this.$file.name + '" contents could not be updated.');
			}
			else
			{
				// TODO do we need this check?
				if (!this.$file.$fetching)
					ide.notify('File "' + data.f + '" was updated.');

				this.$file.read();
			}
		}
	}

	$onMessage(data)
	{
		if (data.stat && data.stat.p===this.$file.path)
			this.$onMessageStat(data.stat);
	}

	destroy()
	{
		this.$bindings[0].unsubscribe();
		this.$bindings[1].unsubscribe();
	}

}

class FileDiff {

	constructor(file)
	{
		this.$file = file;
		this.originalContent = this.$file.content;
		this.diffChanged = false;
	}

	hasChanged()
	{
		return this.$file.content !== this.originalContent;
	}

	diff()
	{
	var
		old = this.originalContent,
		cur = this.$file.content,
		changed = this.diffChanged = this.diffValue !== cur
	;
		if (changed)
		{
			this.diffValue = cur;
			return (this.lastDiff = ide.diffPromise(old, cur));
		} else
			return this.lastDiff;
	}

}

class FileFeature extends ide.Feature {

	constructor(editor, c)
	{
		super(editor, c);

		this.encoding = c.encoding;
		this.$file = c.file;
		this.$sync = new FileSync(this);
		this.$diff = new FileDiff(this);
	}

	get path()
	{
		return this.$file.path;
	}

	get name()
	{
		return this.$file.name;
	}

	get mime()
	{
		return this.$file.mime;
	}

	get stat()
	{
		return this.$file.stat;
	}

	render()
	{
		this.parse();
	}

	diff()
	{
		return this.$diff.diff();
	}

	update()
	{
		return this;
	}

	parse(encoding)
	{
		this.encoding = encoding || this.encoding;
		this.$diff.originalContent = this.content =
			this.$file.decode(this.$file.content, this.encoding) || '';
		ide.plugins.trigger('file.parse', this);

		return this.update();
	}

	read(encoding)
	{
		return this.$file.read().then(() => this.parse(encoding));
	}

	hasChanged()
	{
		return this.$diff.hasChanged();
	}

	delete()
	{
		if (!this.name)
			return ide.warn('File has no name');

		return ide.confirm({
			title: 'Delete File',
			message: 'Are you sure?',
			action: 'Delete'
		}).then(() => {
			if (this.stat.isNew)
				return ide.notify('File does not exist');

			return this.$file.delete();
		}).then(file => {
			ide.notify(`File ${file.name} successfully deleted`);
		});
	}

	write(filename, force)
	{
		if (filename && this.$file.name !== filename)
			this.$file.name = filename;

		if (!force && this.$sync.outOfSync)
			return this.$writeError(File.ERROR_WRITE_OOS);

		return this.$file.write(this.content).then(file => {
			this.parse();
			this.outOfSync = false;
			ide.notify('File ' + file.name + ' saved.');
			ide.plugins.trigger('file.write', this);
		});
	}

	destroy()
	{
		this.$sync.destroy();
	}

	/**
	 * Serialize file to be read by sockets
	 */
	toSocket()
	{
		return {
			id: this.path,
			diff: this.diff()
		};
	}

}

FileFeature.featureName = 'file';
FileFeature.commands = {

	w: 'write',
	f: 'file',

	file: function()
	{
		ide.notify(this.file.name || '[No Name]');
	},

	save: 'write',

	write: function(filename, force) { this.file.write(filename, force); },

	delete: {
		fn: function() { this.file.delete(); },
		description: 'Delete current editor file'
	},

	'w!': function(filename)
	{
		return this.file.write(filename, true);
	},

	'file.encoding': {
		description: 'Reopen File with different encoding',
		fn: function(enc) { return this.file.read(enc); }
	}

};

class FileFormatFeature extends ide.Feature {

	set(format)
	{
		var content, file = this.editor.file;

		if (format==='unix')
			content = file.content.replace(/\r\n?/g, "\n");
		else if (format==='dos')
			content = file.content.replace(/\r?\n/g, "\r\n");
		else if (format==='mac')
			content = file.content.replace(/\r?\n/g, "\r");
		else
			throw new Error("format is required");

		file.content = content;
		file.update();
	}

}

FileFormatFeature.featureName = 'fileFormat';
FileFormatFeature.commands = {

	'fileformat.unix': {
		description: 'Set the file line end format to "\\n"',
		fn: function() { this.fileFormat.set('unix'); }
	},

	'fileformat.dos': {
		description: 'Set the file line end format to "\\r\\n"',
		fn: function() { this.fileFormat.set('dos'); }
	},

	'fileformat.mac': {
		description: 'Set the file line end format to "\\r"',
		fn: function() { this.fileFormat.set('mac'); }
	}

};

FileEditor.features(FileFeature, FileFormatFeature, FileEditorHeader, FileHashFeature);

var fileItem = new ide.DynamicItem({ code: 'file' });

function getTags(file)
{
var
	tags = []
;
	if (file.content && file.content.indexOf)
		tags.push(file.content.indexOf("\r\n")!==-1 ? 'CRLF' : 'LF');

	if (file.stat.isDirectory)
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
		fileItem.title = file.name;
		fileItem.tags = getTags(file);
	}

	// TODO Move to FileSync?
	if (file.$sync.outOfSync)
		done({ title: 'File contents have changed', code: 'file', className: 'error' });

});

Object.assign(ide, {
	File: File,
	FileEditor: FileEditor,
	FileSync: FileSync,
	FileDiff: FileDiff,
	FileItem: FileItem
});

ide.feature.FileFeature = FileFeature;
ide.feature.FileHashFeature = FileHashFeature;
ide.feature.FileEditorHeader = FileEditorHeader;
ide.feature.FileForatFeature = FileFormatFeature;

})(this.cxl, this.ide, this._);
