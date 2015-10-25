/**
 * 
 * workspace.assist
 * 
 */
var
	fs = require('fs'),
	
	plugin = module.exports = cxl('workspace.assist'),
	workspace = require('./workspace'),
	common = workspace.common
;

plugin.extend({
	
	onMessage: function(client, data)
	{
		function done(hints) {
			workspace.socket.respond(client, 'assist', {
				$: data.$,
				hints: hints
			});
		}
		
		data.client = client;
		
		if (data.file)
			fs.readFile(data.file, 'utf8', function(err, file) {
				if (err)
					file = '';

				data.content = data.diff ? common.patch(file, data.diff) : file;

				workspace.plugins.emit('assist', done, data);
			});
		else
			workspace.plugins.emit('assist', done, data);
	}
	
}).run(function() {
	
	workspace.plugins.on('socket.message.assist', this.onMessage.bind(this));
	
});