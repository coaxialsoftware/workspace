/**
 * Chrome debugging extension
 */

(function(ide, $) {
"use strict";

ide.plugins.register('debug', {

	/** WebSocket */
	ws: null,

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

		var editor = new ide.FileList({
			file: '',
			plugin: this,
			title: 'debug'
		});

		ide.workspace.add(editor);

		this.ext.send({ debugger: { targets: true }})
			.then(function(result) {
				editor.add_files(result);
			});
	},

	connect: function(url)
	{
		var ws = this.ws = new WebSocket('ws://localhost:9003/json' || url);

		ws.onmessage = function(ev)
		{
			window.console.log(ev.data);
		};
	},

	load: function(config)
	{
		window.console.log(config);

		$.get('http://localhost:9003/json')
			.then(function(data) {
				window.console.log(data);
			});

		this.connect('ws://localhost:9003/devtools/page/CF49F51C-215C-4FB5-99EE-8D465308FCE1');
	},

	ready: function()
	{
		this.ext = ide.plugins.get('extension');
	}

});

})(this.ide, this.jQuery);