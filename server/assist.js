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
			return fs.readFile(data.file, 'utf8', function(err, file) {
				if (err)
					file = '';

				data.content = data.diff ? common.patch(file, data.diff) : file;

				workspace.plugins.emit('assist', done, data);
			});
		
		if (data.diff)
			data.content = common.patch('', data.diff);

		workspace.plugins.emit('assist', done, data);
	},

	onMessageInline: function(client, data)
	{
		function done(hints) {
			workspace.socket.respond(client, 'assist', {
				$: data.$,
				hints: hints
			});
		}

		data.client = client;
		workspace.plugins.emit('assist.inline', done, data);
	}

}).run(function() {

	workspace.plugins.on('socket.message.assist', this.onMessage.bind(this));
	workspace.plugins.on('socket.message.assist.inline', this.onMessageInline.bind(this));

});