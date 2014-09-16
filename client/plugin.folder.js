
(function(ide, $, _) {
"use strict";

ide.Editor.Folder = ide.Editor.extend({

	file: null,

	initialize: function(p)
	{
		this.file = p.file;
		this.render();
	},

	render: function()
	{
	var
		tpl = _.template($('#tpl-files').html()),
		me = this
	;
		me.$el.addClass('ide-panel').html(tpl(this.file.attributes));

		me.$('.content').click(function(ev) {
			ide.commands.edit(ev.currentTarget.dataset.path);
		});
	}

});

ide.plugins.register('editor.folder', ide.Plugin.extend({

	edit: function(file)
	{
		var editor;

		if (file.get('directory'))
		{
			editor = new ide.Editor.Folder({ file: file });
			ide.workspace.add(editor);
			return true;
		}
	}

}));

})(this.ide, this.jQuery, this._);
