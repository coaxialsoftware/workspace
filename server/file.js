/*
 * workspace.file Module
 *
 * Events:
 *
 * - file.write
 * - file.beforewrite
 *
 */
"use strict";

var
	path = require('path'),
	mime = require('mime'),
	Q = require('bluebird'),

	workspace = require('./workspace'),
	common = require('./common'),

	plugin = module.exports = cxl('workspace.file')
;

mime.default_type = 'text/plain';

class File {

	static fromSocket(data)
	{
		var file = new File(data.id);

		return file.read().then(function(file) {
			if (data.diff)
				common.patch(file.content, data.diff);

			return file;
		});
	}

	static getMime(path, stat)
	{
		// TODO add typescript support
		return stat && stat.isDirectory() ? 'text/directory' : mime.lookup(path);
	}

	constructor(filepath, content)
	{
		this.path = path.normalize(filepath);
		this.content = this.originalContent = content;
	}

	getStat()
	{
		return common.stat(this.path).bind(this).then(function(stat) {
			this.mtime = stat.mtime.getTime();
			this.directory = stat.isDirectory();
			this.mime = File.getMime(this.path, stat);

			return stat;
		});
	}

	onContent(content)
	{
		this.originalContent = this.content = content;
		workspace.plugins.emit('file.read', this);
		return this;
	}

	hasChanged()
	{
		return this.originalContent!==this.content;
	}

	read()
	{
		return this.getStat().then(function() {
			return (this.directory ?
				common.list(this.path) :
				common.readFile(this.path, 'utf8')).bind(this)
					.then(this.onContent);
		}, function() {
			this.new = true;
			this.content = '';
			this.mime = File.getMime(this.path);
			return this;
		});
	}

	checkChanged()
	{
		var mtime = this.mtime;

		return this.getStat().then(function() {
			if (mtime !== this.mtime)
				return Q.reject("File contents have changed.");
		}, function(err) {
			if (err.cause.code!=='ENOENT')
				return Q.reject(err);
		});
	}

	write()
	{
		function OnWrite()
		{
			this.new = false;

			workspace.plugins.emit('file.write', this);
			return this;
		}

		function WriteFile()
		{
			workspace.plugins.emit('file.beforewrite', this);
			return common.writeFile(this.path, this.content);
		}

		return this.checkChanged().then(WriteFile)
			.then(this.getStat).then(OnWrite);
	}

}

workspace.File = File;

plugin.config(function() {

	this.server = workspace.server;
	workspace.plugins.on('socket.message.file', this.onMessage.bind(this));

}).extend({

	/**
	 * data.p    File path.
	 * data.t    File mtime.
	 */
	onMessageStat(client, data)
	{
		common.stat(data.p).bind(this).then(function(stat) {
			if (stat && stat.mtime.getTime()!==data.t)
			{
				this.dbg(`[onMessageStat] File changed: ${data.p}`);

				var response = {
					path: data.p,
					mtime: stat.mtime.getTime()
				};

				workspace.socket.respond(client, 'file', response);
			}
		});
	},

	onMessage(client, data)
	{
		/* See if file has changed, and get contents if updated. */
		if (data.stat)
			this.onMessageStat(client, data.stat);
	},

	getPath: function(project, filename)
	{
		return path.normalize(path.join(project, filename||''));
	},

	getFile: function(filename, body)
	{
		return (new File(filename, body)).read();
	},

	writeFile: function(filepath, body, mtime)
	{
		var file = new File(filepath, body);
		file.mtime = mtime;
		return file.write();
	},

	handleWrite: function(req, res)
	{
	var
		filepath = this.getPath(req.query.p, req.query.n||'')
	;
		if (!req.body)
			return res.status(400).end();

		this.log(`Writing "${filepath}" (${req.body.length})`);

		common.respond(this, res, this.writeFile(filepath, req.body, +req.query.t)
			.then(this.sendFile.bind(this, res)));
	},

	sendFile: function(res, file)
	{
		res.setHeader('content-type', file.mime);
		if (file.mtime)
			res.setHeader('last-modified', file.mtime);
		res.setHeader('ws-file-id', file.path);
		res.send(file.content);
	}
})

.route('GET', '/file', function(req, res)
{
	var filepath = this.getPath(req.query.p, req.query.n);

	this.log(`Reading "${filepath}".`);

	common.respond(
		this, res, this.getFile(filepath).then(this.sendFile.bind(this, res))
	);
})

.route('POST', '/file', 'handleWrite')

.route('PUT', '/file', 'handleWrite');
