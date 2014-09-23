
(function(ide, $, _) {
"use strict";

ide.FileList = ide.Editor.extend({

	template: '#tpl-filelist',
	file_template: '#tpl-file',

	title: null,
	path: null,
	files: null,
	on_click: null,

	getContent: function()
	{
	var
		tpl = _.template($(this.file_template).html()),
		result = '',
		i = 0
	;
		for (; i<this.files.length;i++)
			result += tpl({ path: this.path, file: this.files[i] });

		return result;
	},

	setup: function()
	{
	var
		tpl = _.template($(this.template).html()),
		me = this
	;
		me.$el.addClass('ide-panel').html(tpl({
			title: me.title,
			content: me.getContent(),
		}));

		me.$('.content').click(function(ev) {
			if (me.on_click)
				me.on_click(ev.currentTarget.dataset.path);
			else
				ide.commands.edit(ev.currentTarget.dataset.path);

			ide.workspace.remove(me);
		});
	}
});

ide.plugins.register('find', new ide.Plugin({

	commands: {
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
			else
				ide.workspace.add(new ide.FileList({
					files: files,
					title: 'find ' + mask,
					path: '.'
				}));
		}
	}

}));

ide.plugins.register('editor.folder', new ide.Plugin({

	edit: function(file)
	{
		var editor, files;

		if (file.get('directory'))
		{
			files = file.get('content');
			files.unshift('..');

			editor = new ide.FileList({
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
