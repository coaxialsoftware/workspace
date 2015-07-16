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
		retry,
		doc = window.document,
		config = ide.project.attributes
	;
		this.config = cxl.extend({
			host: doc.location.hostname,
			port: config['socket.port'] 
		});		

		this.ws = new window.WebSocket(
			'ws://' + this.config.host + ':' + this.config.port, 'workspace');

		this.ws.addEventListener('open', function() {
			retry = false;
			ide.plugins.trigger('socket.ready', this);
		});

		this.ws.addEventListener('error', function(ev) {
			if (retry)
			{
				ide.error('Could not connect to socket');
				window.console.error(ev);
			}
			else
			{
				ide.project.fetch({
					success: ide.socket.checkConnection.bind(ide.socket)
				});
				retry = true;
			}
		});

		this.ws.addEventListener('message', function(ev) {
			var msg = JSON.parse(ev.data);

			ide.plugins.trigger('socket.message.' + msg.plugin, msg.data);
		});
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
