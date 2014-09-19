
(function(ide, $, _) {
"use strict";

ide.FileList = ide.Editor.extend({

	title: null,
	path: null,
	files: null,
	on_click: null,

	setup: function()
	{
	var
		tpl = _.template($('#tpl-files').html()),
		me = this
	;
		me.$el.addClass('ide-panel').html(tpl(me));

		me.$('.content').click(function(ev) {
			if (me.on_click)
				me.on_click(ev.currentTarget.dataset.path);
			else
				ide.commands.edit(ev.currentTarget.dataset.path);
			me.close();
		});
	}
});


ide.plugins.register('editor.folder', new ide.Plugin({

	edit: function(file)
	{
		var editor;

		if (file.get('directory'))
		{
			editor = new ide.FileList({
				files: file.get('content'),
				title: file.get('filename'),
				path: file.get('filename')
			});
			ide.workspace.add(editor);
			return true;
		}
	}

}));

})(this.ide, this.jQuery, this._);
