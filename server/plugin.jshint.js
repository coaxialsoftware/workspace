
var
	jshint = require('jshint').JSHINT,
	
	workspace = require('./workspace'),
	socket = require('./socket'),
	
	plugin = module.exports = cxl('workspace.jshint')
;

plugin.extend({
	
	onMessage: function(client, data)
	{
		this.dbg(`Linting file ${data.f}`)
		jshint(data.js);
		
		socket.send('jshint', { data: jshint.data() });
	}
	
}).run(function() {
	
	workspace.plugins.on('socket.message.jshint', this.onMessage.bind(this));
	
});