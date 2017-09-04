/**
 * workspace.socket
 */

(function(window, ide, cxl) {
"use strict";

class SocketManager {

	constructor()
	{
		this.retries = 0;
		this.maxRetries = 1;

		if (!window.WebSocket)
			return ide.warn('WebSockets not supported. Some features will not be available.');

		ide.plugins.on('project.load', this.connect, this);
		window.addEventListener('focus', this.checkConnection.bind(this));
	}

	__doSend(plugin, data)
	{
		this.ws.send(JSON.stringify({ plugin: plugin, data: data }));
	}

	/**
	 * Sends Data to Socket. If socket is not ready it will wait until it is
	 * and send it.
	 */
	send(plugin, data)
	{
		if (!this.ws || this.ws.readyState!==WebSocket.OPEN)
		{
			this.connect();
			ide.plugins.once('socket.ready', this.__doSend.bind(this, plugin, data));
		}
		else
			this.__doSend(plugin, data);
	}

	isConnected()
	{
		return this.ws && this.ws.readyState===WebSocket.OPEN;
	}

	connect()
	{
		if (this.ws && (this.ws.readyState===WebSocket.OPEN ||
			this.ws.readyState===WebSocket.CONNECTING))
			return;
		if (!ide.project.id)
			return;
	var
		doc = window.document,
		config = ide.project.attributes,
		me = this,
		ws
	;
		this.config = cxl.extend({
			host: doc.location.hostname,
			port: config['socket.port']
		});

		ws = this.ws = new window.WebSocket(
			(config['socket.secure'] ? 'wss://' : 'ws://') +
			this.config.host + ':' + this.config.port, 'workspace');

		ws.onopen = function() {
			me.retries = 0;
			ide.socket.send('project', {
				path: config.path, $: config.$
			});
			ide.plugins.trigger('socket.ready', this);
		};

		ws.onclose = function() {
			me.checkConnection();
		};

		ws.onerror = function(ev) {
			if (me.retries>=me.maxRetries)
			{
				ide.error('Could not connect to socket');
				window.console.error(ev);
			}
			else
			{
				me.retries++;
				ide.warn('Could not connect to socket. Retrying (' +
					me.retries + '/' + me.maxRetries + ')');
				// Ignore error
				ide.project.fetch().catch(() => {});
			}
		};

		ws.onmessage = function(ev) {
			var msg = JSON.parse(ev.data);

			if (msg.error)
				ide.error({ code: msg.plugin, title: "ERROR: " + msg.error });
			else
				ide.plugins.trigger('socket.message.' + msg.plugin, msg.data);
		};
	}

	checkConnection()
	{
		if (this.ws && this.ws.readyState===window.WebSocket.CLOSED)
		{
			this.retries = 0;
			ide.project.fetch();
		}
	}

}

ide.Socket = SocketManager;
ide.socket = new SocketManager();

})(this, this.ide, this.cxl);
