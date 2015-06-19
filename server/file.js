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
			this.stat = stat;
			this.directory = stat.isDirectory();

			return (this.directory ?
				common.readDirectory(this.path) :
				common.readFile(this.path, 'utf8')).bind(this)
					.then(this.onContent);

		}, function() {
			this.new = true;
			return this;
		});
	}

	checkChanged()
	{
	var
		stat = this.stat,
		mtime = stat && (new Date(stat.mtime)).getTime()
	;
		return this.getStat().then(function(stat) {
			if (mtime !== stat.mtime.getTime())
				return Q.reject("File contents have changed.");
		}, function(err) {
			if (err.code!=='ENOENT')
				return Q.reject(err);
		});
	}

	write()
	{
		function OnWrite(stat)
		{
			this.stat = stat;
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

}).extend({

	sendError: function(res, err)
	{
		this.error(err);
		res.status(500).send({ error: err.toString() });
	},

	getPath: function(project, filename)
	{
		return path.normalize((project ? project + '/' : '') + filename);
	},

	getFile: function(project, filename)
	{
		return (new File(this.getPath(project, filename))).read();
	},

	writeFile: function(body)
	{
	var
		filepath = this.getPath(body.project, body.filename)
	;
		return (new File(filepath, body)).write();
	},

	handleWrite: function(req, res) {

		if (!req.body)
			return res.status(400).end();

		this.log(`Writing ${req.body.path} (${req.body.content.length})`);

		this.writeFile(req.body).then(function(result) {
			res.send(result);
		}, plugin.sendError.bind(this, res));
	}
})

.route('GET', '/file', function(req, res) {

	this.log(`Reading "${req.query.p}/${req.query.n}".`);

	this.getFile(req.query.p, req.query.n).then(function(result)
	{
		res.send(result);
	}, this.sendError.bind(this, res));

})

.route('POST', '/file', 'handleWrite')

.route('PUT', '/file', 'handleWrite');
