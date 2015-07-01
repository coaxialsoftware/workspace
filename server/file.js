/*
 * workspace.file Module
 */
"use strict";

var
	path = require('path'),
	mime = require('mime'),
	Q = require('bluebird'),

	cxl = require('cxl'),

	workspace = require('./workspace'),
	common = require('./common'),

	plugin = module.exports = cxl('workspace.file')
;

class File {

	constructor(filepath, options)
	{
		if (options)
			cxl.extend(this, options);

		if (this.filename)
			this.filename = path.normalize(this.filename);

		this.path = filepath;
		this.mime = mime.lookup(this.path);
	}

	getStat()
	{
		return common.stat(this.path).bind(this);
	}

	onContent(content)
	{
		this.content = content;
		return this;
	}

	read()
	{
		return this.getStat().then(function(stat) {
			this.mtime = stat.mtime.getTime();
			this.directory = stat.isDirectory();

			return (this.directory ?
				common.list(this.path) :
				common.readFile(this.path, 'utf8')).bind(this)
					.then(this.onContent);

		}, function() {
			this.new = true;
			this.content = '';
			return this;
		});
	}

	checkChanged()
	{
		return this.getStat().then(function(stat) {
			if (this.mtime !== stat.mtime.getTime())
				return Q.reject("File contents have changed.");
		}, function(err) {
			if (err.cause.code!=='ENOENT')
				return Q.reject(err);
		});
	}

	write()
	{
		function OnWrite(stat)
		{
			this.mtime = stat.mtime.getTime();
			this.new = false;
			return this;
		}

		function WriteFile()
		{
			return common.writeFile(this.path, this.content);
		}

		return this.checkChanged().then(WriteFile)
			.then(this.getStat).then(OnWrite);
	}

}

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
				
				common.read(data.p).then(function(content) {
					client.send(common.payload('file', {
						path: data.p,
						stat: stat.mtime.getTime(),
						content: content
					}));
				});
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
		return path.normalize((project ? project + '/' : '') + filename);
	},

	getFile: function(filename, body)
	{
		return (new File(filename, body)).read();
	},

	writeFile: function(filepath, body)
	{
		return (new File(filepath, body)).write();
	},

	handleWrite: function(req, res)
	{
	var
		filepath = this.getPath(req.body.project, req.body.filename)
	;
		if (!req.body)
			return res.status(400).end();

		this.log(`Writing "${filepath}" (${req.body.content.length})`);

		common.respond(this, res, this.writeFile(filepath, req.body));
	}
})

.route('GET', '/file', function(req, res) {
var
	filepath = this.getPath(req.query.p, req.query.n)
;
	this.log(`Reading "${filepath}".`);

	common.respond(this, res, this.getFile(filepath, { filename: req.query.n }));
})

.route('POST', '/file', 'handleWrite')

.route('PUT', '/file', 'handleWrite');
