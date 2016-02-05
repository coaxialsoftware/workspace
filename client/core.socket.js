/**
 * workspace.socket
 */

(function(window, ide, cxl) {
"use strict";
	
function SocketManager()
{
	if (!window.WebSocket)
		return ide.warn('WebSockets not supported. Some features will not be available.');

	ide.plugins.on('project.load', this.connect, this);
	window.addEventListener('focus', this.checkConnection.bind(this));
}
	
SocketManager.prototype = {
	
	__doSend: function(plugin, data)
	{
		this.ws.send(JSON.stringify({ plugin: plugin, data: data }));
	},

	/**
	 * Sends Data to Socket. If socket is not ready it will wait until it is
	 * and send it.
	 */
	send: function(plugin, data)
	{
		if (!this.ws || this.ws.readyState!==WebSocket.OPEN)
			ide.plugins.once('socket.ready', this.__doSend.bind(this, plugin, data));
		else
			this.__doSend(plugin, data);
	},

	connect: function()
	{
		if (this.ws && (this.ws.readyState===WebSocket.OPEN ||
			this.ws.retry))
			return;
	var
		retry,
		doc = window.document,
		config = ide.project.attributes,
		ws
	;
		this.config = cxl.extend({
			host: doc.location.hostname,
			port: config['socket.port'] 
		});		

		ws = this.ws = new window.WebSocket(
			(config['socket.secure'] ? 'wss://' : 'ws://') +
			this.config.host + ':' + this.config.port, 'workspace');

		ws.addEventListener('open', function() {
			retry = false;
			ide.socket.send('project', {
				path: config.path, $: config.$
			});
			ide.plugins.trigger('socket.ready', this);
		});

		ws.addEventListener('error', function(ev) {
			if (retry)
			{
				ide.error('Could not connect to socket');
				window.console.error(ev);
			}
			else
			{
				ws.retry = true;
				ide.project.fetch();
			}
		});

		this.ws.addEventListener('message', function(ev) {
			var msg = JSON.parse(ev.data);
			
			if (msg.error)
				ide.error({ code: msg.plugin, title: "ERROR: " + msg.error });
			else
				ide.plugins.trigger('socket.message.' + msg.plugin, msg.data);
		});
	},

	checkConnection: function()
	{
		if (this.ws && this.ws.readyState===3 /* closed */)
			this.connect();
	}

};
	
ide.socket = new SocketManager();

})(this, this.ide, this.cxl);
