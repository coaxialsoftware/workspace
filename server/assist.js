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

class LanguageServer {
	
	constructor(pluginName, mimeMatch)
	{
		workspace.plugins.on('assist', this.$onAssist.bind(this));
		workspace.plugins.on('assist.inline', this.$onInlineAssist.bind(this));
		
		this.$plugin = pluginName;
		this.$mime = mimeMatch;
	}
	
	onAssist()
	{
	}
	
	onInlineAssist()
	{
	}
	
	findArray(array, term, fn)
	{
		var i=0, l=array.length, index, result=[], tl=term.length;
		
		for (;i<l;i++)
			if ((index=array[i].indexOf(term))!==-1)
				result.push(fn({
					title: array[i],
					matchStart: index,
					matchEnd: index+tl,
					priority: index
				}));
		
		return result;
	}
	
	canAssist(data)
	{
		var project = workspace.projectManager.getProject(data.project);
		
		return project.hasPlugin(this.$plugin) &&
			(!this.$mime || this.$mime.test(data.mime));
	}
	
	$onAssist(done, data)
	{
		if (this.canAssist(data))
			this.onAssist(done, data);
	}
	
	$onInlineAssist(done, data)
	{
		if (this.canAssist(data))
			this.onInlineAssist(done, data);
	}
	
}

workspace.LanguageServer = LanguageServer;

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
			workspace.socket.respond(client, 'assist.inline', {
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