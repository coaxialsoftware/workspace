/**
 * workspace.socket
 */
"use strict";

var
	WebSocketServer = require('websocket').server,
	http = require('http'),

	workspace = require('./workspace'),

	plugin = module.exports = cxl('workspace.socket')
;

plugin.extend({
	
	/** We store all active connections here */
	clients: null,

	onMessage: function()
	{
	},
	
	payload: function(plugin, data)
	{
		try {
			return JSON.stringify({ plugin: plugin, data: data });
		} catch (e) {
			this.error(e);
			return JSON.stringify({ plugin: plugin, error: e.message });
		}
	},

	/**
	 * Send data to all clients.
	 * @param plugin to send data to.
	 * @param data Payload
	 * @param clients Optional array of socket clients to send data.
	 */
	broadcast: function(plugin, data, clients)
	{
	var
		payload = this.payload(plugin, data),
		size = Buffer.byteLength(payload),
		i
	;
		clients = clients || this.clients;
		
		this.dbg(`Broadcasting ${payload} (${size} bytes) to ${clients.length} client(s).`);

		for (i in clients)
			if (clients[i].send)
				clients[i].send(payload);
	},
	
	/**
	 * Send message back to client.
	 */
	respond: function(client, plugin, data)
	{
		client.send(this.payload(plugin, data));
	},
	
	onProjectLoad: function(project)
	{
		project.configuration['socket.port'] = plugin.port;
	}

}).config(function() {
var
	ws = workspace.configuration
;
	this.port = ws['socket.port'];
	this.host = ws['socket.host'] || workspace.host; 

	this.clients = { length: 0 };

	workspace.plugins.on('project.load', this.onProjectLoad);
	workspace.plugins.on('workspace.load', this.onProjectLoad);
	workspace.socket = plugin;

}).run(function() {

var
	id = 0,
	me = this,
	server = http.createServer(function(req, res) {
		res.writeHead(404);
		res.end();
	})
;
	// TODO add support for https
	server.listen(this.port, this.host, function() {
		var a = server.address();
		me.port = a.port;
		me.log(`Listening to ${a.address}:${a.port}`);
	});

	this.ws = new WebSocketServer({
		httpServer: server,
		// TODO safe?
		maxReceivedFrameSize: Infinity,
		maxReceivedMessageSize: Infinity
	});

	this.ws.on('request', function(request) {

		var client = request.accept('workspace', request.origin);
		me.log(`Client connected ${client.remoteAddress}`);

		// TODO is this safe?
		me.clients[(client.id=id++)] = client;
		me.clients.length++;

		client.on('close', function(reason, description) {
			me.log(`Client disconnected ${client.remoteAddress} (${reason} ${description})`);
			me.clients.length--;
			delete(me.clients[client.id]);
		});

		client.on('message', function(msg) {
			var json = JSON.parse(msg.utf8Data);

			if (json.plugin==='socket')
				me.onMessage(client, json.data);

			workspace.plugins.emit('socket.message.' + json.plugin,
				client, json.data);
		});
	});

});
