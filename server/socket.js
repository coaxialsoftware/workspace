/**
 * workspace.socket
 */
"use strict";

var
	cxl = require('cxl'),
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

	/**
	 * Send data to all clients.
	 * @param plugin to send data to.
	 * @param data Payload
	 */
	send: function(plugin, data)
	{
		var payload = JSON.stringify({ plugin: plugin, data: data }), i;

		for (i in this.clients)
			this.clients[i].send(payload);
	},
	
	onProjectLoad: function(project)
	{
		project.configuration['socket.port'] = plugin.port;
	}

}).config(function() {

	var config = cxl.extend({
		host: workspace.host
	}, workspace.configuration.socket);

	this.port = config.port;
	this.host = config.host;

	this.clients = {};

	workspace.plugins.on('project.load', this.onProjectLoad);
	workspace.plugins.on('workspace.load', this.onProjectLoad);

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

	this.ws = new WebSocketServer({ httpServer: server });

	this.ws.on('request', function(request) {

		var client = request.accept('workspace', request.origin);
		me.log(`Client connected ${client.remoteAddress}`);

		// TODO is this safe?
		me.clients[(client.id=id++)] = client;

		client.on('close', function(reason, description) {
			me.log(`Client disconnected ${client.remoteAddress} (${reason} ${description})`);
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
