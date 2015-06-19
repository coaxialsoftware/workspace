/**
 * workspace.socket
 */

var
	cxl = require('cxl'),
	WebSocketServer = require('websocket').server,
	http = require('http'),

	workspace = require('./workspace'),

	plugin = module.exports = cxl('workspace.socket')
;

plugin.config(function() {

	var config = cxl.extend({
		host: workspace.host
	}, workspace.configuration.socket);

	this.port = config.port;
	this.host = config.host;

	workspace.plugins.on('project.load', function(project) {
		project.socket = {
			port: plugin.port
		};
	});

}).run(function() {

var
	me = this,
	server = http.createServer(function(req, res) {
		res.writeHead(404);
		res.end();
	})
;
	server.listen(this.port, this.host, function() {
		var a = server.address();
		me.port = a.port;
		me.log(`Listening to ${a.address}:${a.port}`);
	});

	this.ws = new WebSocketServer({ httpServer: server });

	this.ws.on('request', function(request) {

		var client = request.accept('workspace', request.origin);
		me.log(`Client connected: ${client.remoteAddress}`);

		client.on('close', function(reason, description) {
			me.log(`Client disconnected: ${client.remoteAddress} (${reason} ${description})`);
		});

	});

});
