/**
 * workspace.dragdrop
 *
 * Drag and Drop functionality
 *
 */

(function(ide) {
"use strict";

ide.plugins.register('dragdrop', {

	on_dragover: function(ev)
	{
		ev.preventDefault();
		ev.dataTransfer.dropEffect = 'copy';
	},

	on_readfile: function(file, ev)
	{
		ide.open({
			filename: file.name,
			content: ev.target.result
		});
	},

	on_drop: function(ev)
	{
	var
		files = ev.dataTransfer.files,
		i = 0, reader
	;
		ev.preventDefault();

		for (; i < files.length; i++)
		{
			reader = new FileReader();
			reader.onload = this.on_readfile.bind(this, files[i]);
			reader.readAsText(files[i]);
		}
	},

	start: function()
	{
		window.addEventListener('dragover', this.on_dragover.bind(this));
		window.addEventListener('drop', this.on_drop.bind(this));
	}

});

})(this.ide);