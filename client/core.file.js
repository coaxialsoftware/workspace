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
		this.subscriber = ide.plugins.on('socket.message.file', this.onMessage, this);
		this._createHint();
	}

	onSave()
	{
		this.outOfSync = false;
		ide.notify('File ' + this.id + ' saved.');
		ide.plugins.trigger('file.write', this);
	}

	_createHint()
	{
	var
		separator = this.content.indexOf("\r\n")!==-1 ? 'CRLF' : 'LF',
		tags = [ separator ]
	;
		if (this.isDirectory())
			tags.push('directory');
		else if (this.mime)
			tags.push(this.mime);

		this.hint = new ide.Item({
			code: 'file', title: this.filename, tags: tags
		});
	}

	isNew()
	{
		return !this.mtime;
	}

	parse(xhr)
	{
		var m = CONTENT_TYPE_REGEX.exec(xhr.getResponseHeader('content-type'));

		this.mime = m[1];
		this.encoding = m[2];
		// TODO support other content types
		this.content = this.originalContent = this.mime==='text/directory' ?
			JSON.parse(xhr.responseText) : xhr.responseText;

		this.id = xhr.getResponseHeader('ws-file-id');
		this.mtime = xhr.getResponseHeader('last-modified');

		this.$fetching = null;
		ide.plugins.trigger('file.parse', this);

		return this;
	}

	hasChanged()
	{
		return this.content !== this.originalContent;
	}

	setContent(content)
	{
		// TODO ? should we fire change and not parse?
		if (this.content!==content)
		{
			this.content = content;
			ide.plugins.trigger('file.parse', this);
		}
	}

	onError(res)
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
		ide.plugins.trigger('file.message', this, data);
	}

	fetch()
	{
		var url = this.$url();

		if (this.$fetching)
			return this.$fetching;

		return (this.$fetching = cxl.ajax.xhr({ url: url })
			.then(this.parse.bind(this), this.onError.bind(this)));
	}

	isDirectory()
	{
		return this.mime === 'text/directory';
	}

	write(filename, force)
	{
		if (this.isDirectory())
			return ide.warn('Cannot write to directory');

		if (filename && this.filename !== filename)
			this.filename = filename;

		if (!this.filename)
			return ide.error('No file name.');

		if (!force && this.outOfSync)
			return ide.error('File contents have changed.');

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
		}).then(this.parse.bind(this))
			.then(this.onSave.bind(this), this.onError.bind(this));
	}

	$url()
	{
		// TODO remove this and use etag
		var mtime = this.mtime || Date.now();

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
		this.subscriber.unsubscribe();
	}

}

Object.assign(File.prototype, cxl.Events);

class FileFeature {

	constructor(editor, config)
	{
		this.editor = editor;
		editor.file = this.file = config.file;
		editor.listenTo(ide.plugins, 'file.parse', this.onFileParse.bind(this));
	}

	// TODO Listening to ide.plugins for this might be dangerous
	onFileParse(file)
	{
		if (file!==this.file)
			return;

		this.read(file);
	}

	destroy()
	{
		this.editor.file.destroy();
	}

}

function fileFormatApply(from, to)
{
var
	file = ide.editor.file,
	content
;
	if (file instanceof ide.File)
	{
		content = file.content;
		file.setContent(content.replace(from, to));
	}
}

FileFeature.featureName = 'file';
FileFeature.commands = {

	w: 'write',
	f: 'file',

	file: function()
	{
		ide.notify(ide.editor.file ?
			ide.editor.file.id || '[No Name]' :
			'No files open.');
	},

	save: 'write',

	write: function(filename, force)
	{
		this.file.write(filename, force);
	},

	'w!': function(filename)
	{
		this.file.write(filename, true);
	},

	'fileformat.unix': {
		description: 'Set the file line end format to "\\n"',
		fn: function() { fileFormatApply(/\r\n?/g, "\n"); }
	},

	'fileformat.dos': {
		description: 'Set the file line end format to "\\r\\n"',
		fn: function() { fileFormatApply(/\r?\n/g, "\r\n"); }
	},

	'fileformat.mac': {
		description: 'Set the file line end format to "\\r"',
		fn: function() { fileFormatApply(/\r?\n/g, "\r"); }
	}

};

class FileHashFeature extends ide.feature.HashFeature {

	get()
	{
	var
		editor = this.editor,
		cmd = editor.command || '',
		args = editor.arguments ? this.serializeArgs(editor.arguments) :
			(editor.file.filename || '')
	;
		return (cmd ? cmd+':' : '') + args;
	}
}

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
		// TODO This might not be ideal
		this.editor.listenTo(ide.plugins, 'file.message', update);
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
	}

}

FileEditor.features(FileFeature, FileEditorHeader, FileHashFeature);

ide.plugins.on('assist', function(done, editor) {

	if (editor && editor.file)
	{
		if (editor.file instanceof ide.File)
			done(editor.file.hint);

		if (editor.file.outOfSync)
			done({ title: 'File contents have changed', code: 'file', className: 'error' });
	}

});

ide.File = File;
ide.feature.FileFeature = FileFeature;
ide.feature.FileHashFeature = FileHashFeature;
ide.FileEditor = FileEditor;

})(this.cxl, this.ide, this._);
