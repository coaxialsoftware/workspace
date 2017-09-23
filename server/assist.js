/**
 *
 * workspace.assist
 *
 */
"use strict";
var
	fs = require('fs'),

	plugin = module.exports = cxl('workspace.assist')
;

class AssistRequest
{
	constructor(data, client)
	{
		this.$ = data.$;
		this.editor = data.editor;
		this.client = client;
		this.features = data.features;
		this.projectId = data.project;
		this.extended = data.extended;
		this.plugins = data.plugins;
	}

	supports(feature)
	{
		return feature in this.features;
	}

	get project()
	{
		return this.$project ||
			(this.$project = ide.projectManager.getProject(this.projectId));
	}

	respond(feature, method, data)
	{
		if (plugin.version===this.$)
			ide.socket.respond(this.client, 'assist', {
				$: this.$,
				feature: feature,
				method: method,
				params: data
			});
	}

	respondExtended(hints)
	{
		if (plugin.version===this.$ && hints.length)
			ide.socket.respond(this.client, 'assist.extended', {
				$: this.$,
				hints: hints
			});
	}

	respondInline(hints)
	{
		if (plugin.version===this.$ && hints.length)
			ide.socket.respond(this.client, 'assist.inline', {
				$: this.$,
				hints: hints
			});
	}

}

plugin.extend({

	onMessage: function(client, data)
	{
	var
		f = data.features,
		me=this,
		request = new AssistRequest(data, client)
	;
		me.version = data.$;

		function trigger()
		{
			ide.plugins.emit('assist', request);
		}

		if (f.file && f.file.path)
			return fs.readFile(f.file.path, 'utf8', function(err, file) {
				if (err)
					file = '';

				f.file.content = f.file.diff ? ide.File.patch(file, f.file.diff) : file;

				trigger();
			});
		else
			trigger();
	}

}).run(function() {

	ide.plugins.on('socket.message.assist', this.onMessage.bind(this));

});