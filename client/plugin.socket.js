/**
 * workspace.socket
 */

(function(window, ide, cxl) {
"use strict";

ide.plugins.register('socket', ide.socket = new ide.Plugin({

	__doSend: function(plugin, data)
	{
		this.ws.send(JSON.stringify({
			plugin: plugin,
			data: data
		}));
	},

	/**
	 * Sends Data to Socket. If socket is not ready it will wait until it is
	 * and send it.
	 */
	send: function(plugin, data)
	{
		if (this.ws.readyState!==1)
			ide.plugins.once('socket.ready', this.__doSend.bind(this, plugin, data));
		else
			this.__doSend(plugin, data);
	},

	connect: function()
	{
	var
		doc = window.document
	;
		this.config = cxl.extend({
			host: doc.location.hostname,
			port: parseInt(doc.location.port) + 1
		}, ide.project.get('socket'));

		try {
			this.ws = new window.WebSocket(
				'ws://' + this.config.host + ':' + this.config.port, 'workspace');

			this.ws.addEventListener('open', function() {
				ide.plugins.trigger('socket.ready', this);
			});

			this.ws.addEventListener('message', function(ev) {
				var msg = JSON.parse(ev.data);

				ide.plugins.trigger('socket.message.' + msg.plugin, msg.data);
			});

		} catch(e)
		{
			this.error('Could not connect to socket.');
		}
	},

	checkConnection: function()
	{
		if (this.ws && this.ws.readyState===3 /* closed */)
			this.connect();
	},

	start: function()
	{
		if (!window.WebSocket)
			return ide.warn('WebSockets not supported. Some features will not be available.');

		this.connect();

		cxl.$window.focus(this.checkConnection.bind(this));
	}

}));

})(this, this.ide, this.cxl);
