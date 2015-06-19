/**
 * workspace.socket
 */

(function(window, ide, cxl) {
"use strict";

ide.plugins.register('socket', new cxl.Emitter({

	send: function(plugin, data)
	{
		this.ws.send(JSON.stringify({
			plugin: plugin,
			data: data
		}));
	},

	ready: function()
	{
	var
		me = this,
		doc = window.document
	;
		if (!window.WebSocket)
			return ide.warn('WebSockets not supported. Some features will not be available.');

		this.config = cxl.extend({
			host: doc.location.hostname,
			port: parseInt(doc.location.port) + 1
		}, ide.project.get('socket'));

		try {
			this.ws = new window.WebSocket(
				'ws://' + this.config.host + ':' + this.config.port, 'workspace');

			this.ws.addEventListener('open', function() {
				me.trigger('ready', this);
			});

			this.ws.addEventListener('message', function(ev) {
				var msg = JSON.parse(ev.data);

				me.trigger('message.' + msg.plugin, msg.data);
			});

		} catch(e)
		{
			this.error('Could not connect to socket.');
		}

	}

}));

})(this, this.ide, this.cxl);

