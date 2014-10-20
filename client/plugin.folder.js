
(function(ide, $, _) {
"use strict";

ide.FileList = ide.Editor.extend({

	template: '#tpl-filelist',
	file_template: '#tpl-file',

	title: null,
	path: null,
	files: null,

	on_click: function(ev)
	{
	var
		data = ev.currentTarget.dataset,
		options = {}
	;
		if (data.line)
			options.line = data.line;

		if (ev.ctrlKey)
			options.target = '_blank';

		ide.open(data.path, options);

		if (!ev.shiftKey)
			ide.workspace.remove(this);
	},

	add_files: function(files)
	{
	var
		tpl = _.template($(this.file_template).html()),
		result = '',
		i = 0
	;
		for (; i<files.length;i++)
			result += tpl({
				path: this.path, file: files[i],
				ignore: this.ignore
			});

		this.$('.filelist-content').append(result);

		if (!this._focused)
			this._focused = this.$('a:eq(0)').focus();

	},

	setup: function()
	{
	var
		tpl = _.template($(this.template).html()),
		me = this
	;
		me.$el.addClass('ide-panel').html(tpl({
			title: me.title
		}));

		if (me.files)
			me.add_files(me.files);

		me.$el.on('click', '.content', me.on_click.bind(me));
	}
});

ide.plugins.register('find', new ide.Plugin({

	edit: function(mask, options)
	{
		if (options && options.plugin==='find')
			ide.commands.find(mask);
	},

	commands: { /** @lends ide.commands */

		/**
		 * Finds file by mask and displays all matches, if only one found it will
		 * automatically open it.
		 */
		find: function(mask)
		{
		var
			regex = new RegExp(mask),
			files = ide.project.get('files')
		;
			if (!files)
				return ide.warn('[find] No files found in project.');

			files = files.filter(function(val) {
				return regex.test(val);
			});

			if (files.length===1)
				ide.open(files[0]);
			else if (files.length===0)
				ide.notify('No files found that match "' + mask + '"');
			else
				ide.workspace.add(new ide.FileList({
					file: mask,
					plugin: this,
					files: files,
					title: 'find ' + mask,
					path: '.'
				}));
		}

	}

}));

ide.plugins.register('folder', new ide.Plugin({

	edit: function(file)
	{
		var editor, files;

		if (file.get('directory'))
		{
			files = file.get('content');
			files.unshift('..');

			editor = new ide.FileList({
				file: file,
				plugin: this,
				files: files,
				title: file.get('filename'),
				path: file.get('filename')
			});
			ide.workspace.add(editor);
			return true;
		}
	}

}));

})(this.ide, this.jQuery, this._);
