/**
 * Chrome debugging extension
 */

(function(ide) {
"use strict";

ide.plugins.register('debug', new ide.Plugin({

	el: null,

	commands: {

		/** Show debug panel if chrome extension is present */
		debug: function()
		{
			this.open();
		}

	},

	open: function()
	{
		if (!this.ext.enabled)
			return ide.alert('Debugging browser extension not available.');

	var
		me = this,
		editor = new ide.FileList({
			file: '',
			plugin: this,
			title: 'debug',
			file_template: '#tpl-debug',
			on_click: function(ev) {
				me.connect(ev.target.dataset.id);
				ide.workspace.remove(this);
			}
		})
	;

		ide.workspace.add(editor);

		this.ext.send({ api: 'debugger', cmd: 'targets' })
			.then(function(result) {
				editor.add_files(result);
			});
	},

	connect: function(id)
	{
		this.log('Attaching debugger to tab with id ' + id);
		ide.on('beforewrite', function(file) {
			window.console.log(id, file.changed);
		});
		this.data('tab_id', id);
	},

	start: function()
	{
		this.ext = ide.plugins.get('extension');

		var id = this.data('tab_id');

		if (id)
			this.connect(id);
	}

}));

})(this.ide, this.jQuery);