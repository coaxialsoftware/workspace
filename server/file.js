/*
 * workspace.file Module
 */
"use strict";

var
	fs = require('fs'),
	path = require('path'),
	mime = require('mime'),
	Q = require('bluebird'),

	cxl = require('cxl'),

	workspace = require('./workspace')
;

class File {

	constructor(filepath)
	{
		this.path = path.normalize(filepath);
		this.mime = mime.lookup(filepath);
		this.__onContent = this.onContent.bind(this);
		this.__onStat = this.onStat.bind(this);
	}

	onContent(result)
	{
		this.content = result;
		return this;
	}

	onStat(cb, err, stat)
	{
		if (err)
		{
			this.new = true;
			cb(this);
		} else
		{
			this.directory = stat.isDirectory();

			if (this.directory)
				fs.readdir(this.path, this.__onContent);
			else
				fs.readFile(this.path, 'utf8', this.__onContent);
		}
	}

	load(cb)
	{
		fs.stat(this.path, this.onStat.bind(this, cb));
	}

}

class FileManager {

	constructor()
	{
		this.files = {};
	}

	getFile(project, filename, callback)
	{
	var
		path = project + '/' + filename,
		file = this.files[path] || (this.files[path] = new File(path))
	;
		file.load(callback);

		return this;
	}

}

function writeFile(query, body, callback)
{
var
	me = this,
	content = body.content,
	file = (query.p ? query.p+'/' : '') + query.n,
	mtime = query.t,
	project = me._projects[query.p] || me,
	result = {
		success: true
	}
;
	fs.stat(file, function(err, stat)
	{
		if (err && !(err.code==='ENOENT' && body.new))
			return callback(me.error(err));

		if (stat && (mtime !== (stat.mtime.getTime()+'')))
			return callback(me.error("File contents have changed."));

		project.log('Writing ' + file + '(' + content.length + ')');

		fs.writeFile(file, content, function(err)
		{
			if (err)
				callback(me.error(err));
			else
				fs.stat(file, function(err, stat) {
					result.stat = stat;
					result.new = false;
					callback(err ? me.error(err) : result);
				});
		});
	});
}

function HandleWrite(req, res) {

	if (!req.body)
		return res.send(this.error("Invalid request."));

	writeFile(req.query, req.body, function(result)
		{
			res.status(result.success ? 200: 403).send(result);
		}
	);
}

module.exports = cxl('workspace.file').config(function() {

	this.server = workspace.server;
	this.fileManager = new FileManager();

})

.route('GET', '/file', function(req, res) {

	this.fileManager.getFile(req.query.p, req.query.n, function(result)
	{
		res.send(result);
	});

})

.route('POST', '/file', HandleWrite)

.route('PUT', '/file', HandleWrite);
