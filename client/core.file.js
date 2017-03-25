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
		
		this.subscriber = ide.plugins.on('socket.message.file', this.onMessage, this);
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
		ide.plugins.trigger('file.parse', this);
		
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
	
	onMessageStat(data)
	{
		if (this.attributes.mtime!==data.t)
		{
			if (this.hasChanged())
			{
				this.old = true;
				ide.warn('File "' + this.id + '" contents could not be updated.');
			}
			else
			{
				this.fetch();
				ide.notify('File "' + data.f + '" was updated.');
			}
		}
	}

	onMessage(data)
	{
		if (data.stat && data.stat.p===this.id)
			this.onMessageStat(data.stat);
	}
	
	fetch()
	{
		var url = this.url();
		
		return cxl.ajax({ url: url }).then(this.parse.bind(this), this.onError.bind(this));
	}

	write(filename, force)
	{
		if (this.attributes.directory)
			return ide.warn('Cannot write to directory');

		if (filename && this.filename !== filename)
			this.filename = filename;
		
		if (!this.filename)
			return ide.error('No file name.');

		if (!force && this.old)
			return ide.error('File contents have changed.');

		ide.notify('File ' + this.id + ' saved.');
		
		return this.$save();
	}

	$save()
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
	
	destroy()
	{
		this.subscriber.unsubscribe();
	}

}
	
Object.assign(File.prototype, cxl.Events);
	
class FileFeature {
	
	constructor(editor, config)
	{
		editor.file = this.file = config.file;
	}

	destroy()
	{
		this.file.destroy();
	}
	
}

FileFeature.featureName = 'file';
FileFeature.commands = {

	w: 'write',
	save: 'write',

	write: function(filename, force)
	{
		this.file.write(filename, force);
	},

	'w!': function(filename)
	{
		this.file.write(filename, true);
	}

};

class FileHashFeature extends ide.feature.HashFeature {

	get()
	{
	var
		editor = this.editor,
		plugin = editor.plugin && editor.plugin.name || editor.plugin,
		file = editor.file.filename || ''
	;
		return (plugin ? plugin+':' : '') + encodeURIComponent(file);
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
		super.render();
		this.editor.listenTo(ide.plugins, 'file.parse', this.update.bind(this));
		this.update();
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
	}

}
	
FileEditor.features(FileFeature, FileEditorHeader, FileHashFeature);
	
function fileFormatApply(from, to)
{
var
	file = ide.editor.file,
	content
;
	if (file instanceof ide.File)
	{
		content = file.content;
		file.content = content.replace(from, to);
	}
}
	
ide.registerEditorCommand('fileformat.unix', {
	description: 'Set the file line end format to "\\n"',
	run: function() { fileFormatApply(/\r\n?/g, "\n"); }
});
ide.registerEditorCommand('fileformat.dos', {
	description: 'Set the file line end format to "\\r\\n"',
	run: function() { fileFormatApply(/\r?\n/g, "\r\n"); }
});
ide.registerEditorCommand('fileformat.mac', {
	description: 'Set the file line end format to "\\r"',
	run: function() { fileFormatApply(/\r?\n/g, "\r"); }
});
	
ide.plugins.on('assist', function(done, editor) {

	if (editor && editor.file)
	{
		if (editor.file instanceof ide.File)
			done(editor.file.hint);
	}

});

ide.File = File;
ide.feature.FileFeature = FileFeature;
ide.feature.FileHashFeature = FileHashFeature;
ide.FileEditor = FileEditor;

})(this.cxl, this.ide, this._);
