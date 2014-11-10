/**
 * Chrome debugging extension
 */

(function(ide) {
"use strict";

ide.plugins.register('debug', {

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

		this.ext.send({ debugger: { targets: true }})
			.then(function(result) {
				editor.add_files(result);
			});
	},

	connect: function(id)
	{
		window.console.log(id);
	},

	start: function()
	{
		this.ext = ide.plugins.get('extension');
	}

});

})(this.ide, this.jQuery);