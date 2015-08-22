
var
	jshint = require('jshint').JSHINT,
	
	cxl = require('cxl'),
	workspace = require('./workspace'),
	socket = require('./socket'),
	
	plugin = module.exports = cxl('workspace.jshint')
;

plugin.extend({
	
	onMessage: function(client, data)
	{
		this.operation(`Linting file ${data.f}`, jshint.bind(jshint, data.js));
		
		socket.respond(client, 'jshint', jshint.data() );
	}
	
}).run(function() {
	
	workspace.plugins.on('socket.message.jshint', this.onMessage.bind(this));
	
});