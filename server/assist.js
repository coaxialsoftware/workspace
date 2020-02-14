/**
 *
 * workspace.assist
 *
 */
"use strict";
var
	fs = require('fs'),
	fsPromise = fs.promises,

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
		// if (plugin.version===this.$)
			ide.socket.respond(this.client, 'assist', {
				$: this.$,
				feature: feature,
				method: method,
				params: data
			});
	}

	respondExtended(hints)
	{
		// if (plugin.version===this.$ && hints.length)
			ide.socket.respond(this.client, 'assist.extended', {
				$: this.$,
				hints: hints
			});
	}

	respondInline(hints)
	{
		// if (plugin.version===this.$ && hints.length)
			ide.socket.respond(this.client, 'assist.inline', {
				$: this.$,
				hints: hints
			});
	}

}

plugin.extend({

	onMessage(client, data)
	{
	var
		f = data.features,
		me=this,
		request = new AssistRequest(data, client),
		filePath = f.file && f.file.path
	;
		me.version = data.$;

		function trigger()
		{
			ide.plugins.emit('assist', request);
		}
		if (filePath)
			return Promise.all([
				fsPromise.stat(filePath).catch(() => null),
				fsPromise.readFile(filePath, 'utf8').catch(() => '')
			]).then(([stat, content]) => {
				f.file.content = f.file.diff && (!stat || f.file.mtime === stat.mtime.toISOString()) ? ide.File.patch(content, f.file.diff) : content;

				trigger();
			}, (e) => {
				console.log(e);
			});
		else
			trigger();
	}

}).run(function() {

	ide.plugins.on('socket.message.assist', this.onMessage.bind(this));

});