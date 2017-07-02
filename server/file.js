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

	plugin = module.exports = cxl('workspace.file'),
	ServerResponse = require('./http').ServerResponse
;

mime.default_type = 'text/plain';

function getMime(file, stat)
{
	// TODO add typescript support
	return stat && stat.isDirectory ? 'text/directory' : mime.lookup(file);
}

// TODO see if we can remove this
class FileStat {

	constructor(stat)
	{
		if (stat)
		{
			this.atime = stat.atime;
			this.ctime = stat.ctime;
			this.mtime = stat.mtime;
			this.size = stat.size;
			this.isDirectory = stat.isDirectory();
			this.isSymbolicLink = stat.isSymbolicLink();
		} else
		{
			this.isDirectory = false;
			this.isSymbolicLink = false;
		}

		this.isNew = !stat;
	}

}

class File {

	/**
	 * @param filepath Path relative to workspace
	 */
	constructor(filepath)
	{
		this.path = path.normalize(filepath);
	}

	/**
	 * Reads file with optional encoding. If encoding not passed it will return a Buffer
	 */
	read(encoding)
	{
		return plugin.stat(this.path).then(stat => {
			this.stat = stat;
			this.encoding = encoding;

			if (stat.isNew)
				return '';

			return stat.isDirectory ?
				common.list(this.path) :
				common.readFile(this.path, encoding);
		}).then(content => {
			this.content = content;
			this.mime = getMime(this.path, this.stat);
			return this;
		});
	}

	delete()
	{
		return common.unlink(this.path).then(this.read.bind(this));
	}

	write(content)
	{
		return common.writeFile(this.path, content).then(this.read.bind(this));
	}

}

plugin.config(function() {

	this.server = workspace.server;
	workspace.plugins.on('socket.message.file', this.onMessage.bind(this));

}).extend({

	fromSocket: function(data)
	{
		var file = new File(data.id);

		return file.read().then(function(file) {
			if (data.diff)
				common.patch(file.content, data.diff);

			return file;
		});
	},

	/**
	 * @return {FileStat}
	 */
	stat: function(path)
	{
		return common.stat(path).then(stat => {
			return new FileStat(stat);
		}, (err) => {
			if (err.cause.code==='ENOENT')
				return new FileStat();

			return Q.reject(err);
		});
	},

	loadFile: function(filepath, encoding)
	{
		filepath = path.normalize(filepath);
		var file = new File(filepath);
		return file.read(encoding);
	},

	read: function(filepath, encoding)
	{
		return common.readFile(filepath, encoding);
	},

	delete(path)
	{
		return common.unlink(path);
	},

	write(path, content)
	{
		return common.writeFile(path, content);
	},

	/**
	 * data.p    File path.
	 * data.t    File mtime.
	 */
	onMessageStat(client, data)
	{
		this.stat(data.p).then(function(stat) {
			if (stat && !stat.isNew && stat.mtime.getTime()!==data.t)
			{
				workspace.socket.respond(client, 'file', {
					p: data.p,
					t: stat.mtime.getTime()
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

	getFile: function(req)
	{
	var
		project = req.query.p,
		filename = req.query.n
	;
		return this.loadFile(path.join(project, filename||''))
			.then(function(file) {
				file.project = project;
				return file;
			});
	},

	$checkChanged(mtime, file)
	{
		if (!file.stat.isNew && mtime !== file.stat.mtime.getTime())
				return Q.reject("File contents have changed.");

		return file;
	},

	handleWrite: function(req, res)
	{
		if (!req.body)
			return res.status(400).end();

		ServerResponse.respond(res, this.getFile(req)
			.then(file => this.$checkChanged(+req.query.t, file))
			.then(file => {
				this.log(`Writing "${file.path}" (${req.body.length})`);
				return file.write(req.body);
			}).then(file => this.sendFile(res, file))
		);
	},

	sendFile: function(res, file)
	{
		var stat = file.stat;

		res.setHeader('content-type', file.mime);
		res.setHeader('ws-file-stat', JSON.stringify(stat));
		res.setHeader('ws-file-path', file.path);

		// Normalized path relative to project
		// TODO try to remove this
		res.setHeader('ws-file-name', path.normalize(path.relative(file.project, file.path)));

		return file.content;
	}

})

.route('GET', '/file', function(req, res)
{
	ServerResponse.respond(res, this.getFile(req)
		.then(this.sendFile.bind(this, res)), this);
})

.route('DELETE', '/file', function(req, res) {

	ServerResponse.respond(res, this.getFile(req)
		.then(this.$checkChanged.bind(this, +req.query.t))
		.then(file => file.delete())
		.then(this.sendFile.bind(this, res)), this
	);
})

.route('POST', '/file', 'handleWrite')
.route('PUT', '/file', 'handleWrite');
