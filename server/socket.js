/**
 * workspace.socket
 */
'use strict';

var WebSocketServer = require('websocket').server,
	plugin = (module.exports = cxl('workspace.socket'));
// TODO use class instead of module

plugin
	.extend({
		/** We store all active connections here */
		clients: null,

		onMessage: function () {},

		payload(plugin, data) {
			try {
				return JSON.stringify({ plugin: plugin, data: data });
			} catch (e) {
				this.error(e);
				return JSON.stringify({ plugin: plugin, error: e.message });
			}
		},

		closeAll(reasonCode) {
			for (var i in this.clients)
				if (this.clients[i].close) this.clients[i].close(reasonCode);
		},

		/**
		 * Send data to all clients.
		 * @param plugin to send data to.
		 * @param data Payload
		 * @param clients Optional array of socket clients to send data.
		 */
		broadcast(plugin, data, clients) {
			var payload = this.payload(plugin, data),
				size = Buffer.byteLength(payload),
				i;
			clients = clients || this.clients;

			for (i in clients) if (clients[i].send) clients[i].send(payload);
		},

		/**
		 * Send message back to client.
		 */
		respond(client, plugin, data) {
			client.send(this.payload(plugin, data));
		},

		onProjectLoad(project) {
			project.configuration['socket.port'] = plugin.port;
			project.configuration['socket.secure'] = !!plugin.secure;
			project.configuration['socket.proxy'] =
				ide.configuration['socket.proxy'];
		},

		createWebSocketServer() {
			var secure = (this.secure = ide.configuration.secure),
				http = require(secure ? 'https' : 'http'),
				onRequest = function (req, res) {
					res.end();
				},
				server = secure
					? http.createServer(secure, onRequest)
					: http.createServer(onRequest);
			if (secure) this.log('Creating secure socket (https)');

			return server;
		},
	})
	.config(function () {
		var ws = ide.configuration;
		this.port = ws['socket.port'] || 9002;
		// TODO add host property for main module?
		this.host = ws['socket.host'];

		this.clients = { length: 0 };

		ide.plugins.on('project.load', this.onProjectLoad);
		ide.plugins.on('workspace.load', this.onProjectLoad);
		ide.socket = plugin;
	})
	.run(function () {
		var id = 0,
			me = this,
			server = this.createWebSocketServer();
		server.listen(this.port, this.host, function () {
			var a = server.address();
			me.port = a.port;
			me.log(`Listening to ${a.address}:${a.port}`);
		});

		this.ws = new WebSocketServer({
			httpServer: server,
			// TODO safe?
			maxReceivedFrameSize: Infinity,
			maxReceivedMessageSize: Infinity,
		});

		this.ws.on('request', function (request) {
			if (
				ide.authenticationAgent &&
				!ide.authenticationAgent.onSocketRequest(request)
			)
				return request.reject(401);

			var client = request.accept('workspace', request.origin);
			me.log(`Client connected ${client.remoteAddress}`);

			me.clients[(client.id = id++)] = client;
			me.clients.length++;

			client.on('close', function (reason, description) {
				me.log(
					`Client disconnected ${client.remoteAddress} (${reason} ${description})`
				);

				me.clients.length--;
				delete me.clients[client.id];
			});

			client.on('message', function (msg) {
				var json = JSON.parse(msg.utf8Data);

				if (json.plugin === 'socket') me.onMessage(client, json.data);
				else
					ide.plugins.emit(
						'socket.message.' + json.plugin,
						client,
						json.data
					);
			});

			ide.plugins.emit('socket.connect', client);
		});
	});
