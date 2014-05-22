
var
	fs = require('fs'),
	common = require('./common'),
	mime = require('express').mime,

	Project = require('./project').Project,

	Editor = function()
	{
	var
		config = this.config = {
			version: 0.1,
			port: 9001,
			files: [],
			name: 'ide.js',
			path: process.cwd()
		}
	;
		this.log('Loading global settings...');
		common.extend(config, common.load_json('~/.ide.js/config.json'));
		this.log('Loading workspace settings...');
		common.extend(config, common.load_json('workspace.json'));

		// Make sure password is not there
		delete this.config.password;

		this._projects = {};
		this.projects = [];
	}
;

common.extend(Editor.prototype, {

	// Stores instances of projects
	_projects: null,

	// Array of project names
	projects: null,

	log: function(msg)
	{
		console.log("[ide.js] " + msg);
	},

	load: function()
	{
	var
		config = this.config
	;
		config.env = process.env;
		config.projects= this.find_projects();

		return config;
	},

	handle_get_file: function(req, res)
	{
		this.get_file(req.query, function(result)
		{
			res.send(result);
		});
	},

	handle_write_file: function(req, res)
	{
		if (!req.body)
			return res.send(this.error("Invalid request."));

		this.put_file(req.query, req.body,
		function(result)
			{
				res.send(result);
			}
		);
	},

	error: function(err)
	{
		console.error('[ide.js] ERROR ' + err);
		return { error: err, success: false };
	},

	put_file: function(query, body, callback)
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
	},

	get_file: function(query, callback)
	{
	var
		result = { },
		fn = (query.p ? query.p + '/' : '') + query.n
	;
		if (fs.existsSync(fn))
		{
			this.log('Opening file: ' + fn);
			result.stat = fs.statSync(fn);

			result.content = result.stat.isDirectory() ?
				fs.readdirSync(fn)
			:
				result.content = fs.readFileSync(fn, 'utf8')
			;
		} else
		{
			result.content = '';
			result.new = true;
		}

		result.filename = query.n;
		result.path = query.p;
		result.mime = mime.lookup(fn);
		result.success = true;

		callback(result);
	},

	find_projects: function()
	{
	var
		files = fs.readdirSync(this.config.path + '/'),
		projects = {},
		i,
		path
	;
		for (i=0; i<files.length;i++)
		{
			path = files[i];

			if (!fs.statSync(path).isDirectory())
				continue;

			projects[path] = {
				path: path,
				is_git: fs.existsSync(path+'/.git'),
				package: common.load_json(path+'/package.json'),
				project: common.load_json(path+'/project.json')
			};
		}

		return projects;
	},

	// TODO Cleanup...
	load_project: function(name, callback)
	{
	var
		project = name ? this._projects[name] : this
	;
		if (!project)
			project = this._projects[name] = new Project(name, this);

		callback(project);
	},

	to_json: function()
	{
		return this.load();
	}

});

exports.editor = new Editor();
