/**
 * 
 * workspace.assist
 * 
 */
var
	plugin = module.exports = cxl('workspace.assist'),
	workspace = require('./workspace')
;

plugin.extend({
	
	onMessage: function(client, data)
	{
		function done(hints) {
			client.send({
				version: data.version,
				hints: hints
			});
		}
		
		workspace.plugins.emit('assist', done, data.file, data.token);
	}
	
}).run(function() {
	
	workspace.plugins.on('socket.message.assist', this.onMessage.bind(this));
	
});