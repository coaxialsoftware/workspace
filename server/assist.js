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
			workspace.socket.respond(client, 'assist', {
				$: data.version,
				hints: hints
			});
		}
		
		workspace.plugins.emit('assist', done, data.file, data.token, data.project);
	}
	
}).run(function() {
	
	workspace.plugins.on('socket.message.assist', this.onMessage.bind(this));
	
});