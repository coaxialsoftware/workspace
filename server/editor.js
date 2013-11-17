
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

	error: function(err)
	{
		console.error('[ide.js] ERROR ' + err);
		return { error: err, success: false };
	},

	put_file: function(file, mtime, content, callback)
	{
	var
		result = {
			success: true
		},
		stat
	;
		if (fs.existsSync(file))
		{
			stat = fs.statSync(file);

			if (mtime !== (stat.mtime.getTime()+''))
				return callback(this.error("File contents have changed."));
		}

		this.log('Writing ' + file + '(' + content.length + ')');

		fs.writeFile(file, content, function(err)
		{
			result.stat = fs.statSync(file);
			result.new = false;
			callback(err ? this.error(err) : result);
		});
	},

	get_file: function(fn, callback)
	{
	var
		result = { }
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

		result.filename = fn;
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
			projects[path] = {
				path: path,
				is_git: fs.existsSync(path+'/.git'),
				package: common.load_json(path+'/package.json')
			};
		}

		return projects;
	},

	// TODO Cleanup...
	load_project: function(name)
	{
	var
		project = name && this._projects[name]
	;
		if (project)
			return project;

		if (!name)
			return this;

		project = this._projects[name] = new Project(name);

		return project;
	},

	to_json: function()
	{
		return this.load();
	}

});

exports.editor = new Editor();
