/**
 *
 * workspace.assist
 *
 */
"use strict";
var
	fs = require('fs'),
	cp = require('child_process'),
	path = require('path'),

	plugin = module.exports = cxl('workspace.assist'),
	workspace = require('./workspace'),
	common = workspace.common
;

workspace.assist = {

	CanAssistMime: function(mimeRegex) {
		return function(request)
		{
			return request.features.file && mimeRegex.test(request.features.file.mime);
		};
	},

	match: function(term, cursorValue, prefix)
	{
		var index = term.indexOf(cursorValue);

		if (index!==-1)
			return {
				title: prefix ? prefix + term : term,
				matchStart: index,
				matchEnd: index+cursorValue.length,
				priority: index
			};
	},

	findObject: function(obj, cursorValue, fn)
	{
		var i, result=[], match;

		for (i in obj)
			if ((match = this.match(i, cursorValue)))
			{
				if (fn)
					match = fn(match, obj[i], i, cursorValue);
				if (match)
					result.push(match);
			}

		return result;
	},

	findArray: function(array, cursorValue, fn)
	{
		var i=0, l=array.length, result=[], match, value=cursorValue.trimLeft(), prefix;

		if (value!==cursorValue)
			prefix = cursorValue;

		for (;i<l;i++)
			if ((match = this.match(array[i], value, prefix)))
			{
				if (fn)
					match = fn(match, array[i], i, value);
				if (match)
					result.push(match);
			}

		return result;
	}

};

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

	respond(feature, method, data)
	{
		if (plugin.version===this.$)
			workspace.socket.respond(this.client, 'assist', {
				$: this.$,
				feature: feature,
				method: method,
				params: data
			});
	}

	respondExtended(hints)
	{
		if (plugin.version===this.$ && hints.length)
			workspace.socket.respond(this.client, 'assist.extended', {
				$: this.$,
				hints: hints
			});
	}

	respondInline(hints)
	{
		if (plugin.version===this.$ && hints.length)
			workspace.socket.respond(this.client, 'assist.inline', {
				$: this.$,
				hints: hints
			});
	}

}

class AssistServer {

	constructor()
	{
		workspace.plugins.on('assist', this.$onAssist.bind(this));
	}

	/** @abstract */
	canAssist() {}

	/** @abstract */
	onAssist() {}

	$doInline(req)
	{
		var hints = this.inlineAssist(req, req.respondInline.bind(req));

		if (hints)
			req.respondInline(hints);
	}

	$doExtended(req)
	{
		var hints = this.extendedAssist(req, req.respondExtended.bind(req));

		if (hints)
			req.respondExtended(hints);
	}

	$onAssist(request)
	{
		if (this.canAssist(request))
		{
			this.onAssist(request);

			if (request.features.token && this.inlineAssist)
				this.$doInline(request);
			if (request.extended && this.extendedAssist)
				this.$doExtended(request);
		}
	}

}

class JSONRPC {

	constructor(read, write)
	{
		this.$read = read;
		this.$write = write;
		this.$ = 0;
		this.$requests = {};
		this.$buffer = '';

		this.$read.on('data', this.$onResponse.bind(this));
	}

	request(method, params)
	{
	var
		id = this.$++,
		stdin = this.$write,
		data = {
			jsonrpc: "2.0",
			method: method,
			params: params,
			id: id
		},
		json = JSON.stringify(data),
		length = json.length,
		promise = new Promise((resolve, reject) => {
			this.$requests[id] = { resolve: resolve, reject: reject };
			stdin.write('Content-Length: ' + length + "\r\n\r\n" + json, 'utf8');
		})
	;
		return promise;
	}

	$onResponse(data)
	{
		this.$buffer = data = this.$buffer + data.toString();
	var
		match = data.match(/Content-Length:\s+(\d+)(?:.*)\r\n\r\n(.+)/),
		length, json, response, request
	;
		if (!match)
			return;

		length = match[1];
		response = match[2];

		if (length < response.length)
			return;

		json = JSON.parse(response.slice(0, length));
		this.$buffer = response.slice(length);

		if (json.id!==undefined)
		{
			request = this.$requests[json.id];

			if (json.result)
				request.resolve(json.result);
			else if (json.error)
				request.reject(json.error);
		}
		// TODO handle notification messages
	}

}

class LanguageServerStdIO extends AssistServer {

	constructor(plugin, binPath, canAssist)
	{
		super();
		this.plugin = plugin || workspace;
		this.binPath = binPath;
		this.ready = false;
		this.$canAssist = canAssist;
	}

	canAssist(request)
	{
		return this.ready && this.$canAssist(request);
	}

	requestCompletion(request)
	{
	var
		token = request.features.token
	;
		return this.jsonrpc.request('textDocument/completion', {
			textDocument: {
				uri: this.uri(request)
			},
			position: {
				line: token.row,
				character: token.column
			}
		}).then(result => {
			console.log(result);
		});
	}

	uri(request)
	{
		return 'file:' + path.resolve(request.features.file.path);
	}

	inlineAssist(request)
	{
	var
		features = request.features,
		file = features.file
	;
		if (file.diffChanged)
			this.jsonrpc.request('textDocument/didOpen', {
				textDocument: {
					uri: this.uri(request),
					version: 0,
					text: file.content,
					languageId: 'javascript'
				}
			}).then(this.requestCompletion.bind(this, request));
		else
			this.requestCompletion(request);
	}

	/*extendedAssist(request)
	{
	}*/

	$initialize()
	{
		return this.jsonrpc.request('initialize', {
			processId: process.pid,
			rootUri: 'file:/' + workspace.cwd,
			capabilities: {
				/*workspace: {
					applyEdit: true,
					symbol: {
						dynamicRegistration: true
					},
					executeCommand: {
						dynamicRegistration: true
					}
				},*/
				textDocument: {
					completion: {}
				}
			},
			trace: workspace.configuration.debug ? 'verbose' : 'off'
		}).then(response => {
			this.supportedCapabilities = response;
			this.ready = true;
		});
	}

	$onError(data)
	{
		this.plugin.error(data.toString());
	}

	$onClose(code, signal)
	{
		this.plugin.error(`Process closed ${code} ${signal}`);
	}

	start()
	{
		if (this.cp)
			return;

		// TODO get node executable
		var ls = this.cp = cp.spawn(process.execPath, [ this.binPath ]);

		this.jsonrpc = new JSONRPC(ls.stdout, ls.stdin);

		ls.on('close', this.$onClose.bind(this));
		ls.on('error', this.$onError.bind(this));

		ls.stderr.on('data', this.$onError.bind(this));

		return this.$initialize();
	}

}

class LanguageServer extends AssistServer {

	constructor(pluginName, mimeMatch, fileMatch)
	{
		super();
		workspace.plugins.on('assist.inline', this.$onInlineAssist.bind(this));

		this.$plugin = pluginName;
		this.$mime = mimeMatch;
		this.$fileMatch = fileMatch;
	}

	onInlineAssist()
	{
	}

	canAssist(data)
	{
	var
		project = workspace.projectManager.getProject(data.project),
		file = data.features.file
	;
		return file && project.hasPlugin(this.$plugin) &&
			(!this.$mime || this.$mime.test(file.mime)) &&
			(!this.$fileMatch || this.$fileMatch.test(file.path));
	}

	$onInlineAssist(done, data)
	{
		if (this.canAssist(data))
			this.onInlineAssist(done, data);
	}

}

LanguageServer.prototype.match = workspace.assist.match;
LanguageServer.prototype.findObject = workspace.assist.findObject;
LanguageServer.prototype.findArray = workspace.assist.findArray;

workspace.assist.LanguageServerStdIO = LanguageServerStdIO;
workspace.assist.Server = AssistServer;

workspace.LanguageServer = LanguageServer;

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
			workspace.plugins.emit('assist', request);
		}

		if (f.file && f.file.path)
			return fs.readFile(f.file.path, 'utf8', function(err, file) {
				if (err)
					file = '';

				f.file.content = f.file.diff ? common.patch(file, f.file.diff) : file;

				trigger();
			});
		else
			trigger();
	}

}).run(function() {

	workspace.plugins.on('socket.message.assist', this.onMessage.bind(this));

});