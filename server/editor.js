
var
	fs = require('fs'),
	common = require('./common'),
	mime = require('mime'),
	Q = require('bluebird'),
	path = require('path'),
	colors = require('colors'),

	cxl = require('cxl'),

	Project = require('./project').Project
;

exports.editor = cxl('editor').run(function() {
var
	config = this.config = {
		version: 0.1,
		port: 9001,
		files: [],
		name: 'workspace',
		path: process.cwd()
	}
;
	this.log('Loading global settings...');
	common.extend(config, common.load_json_sync('~/.workspace/config.json'));

	this.log('Loading workspace settings...');
	common.extend(config, common.load_json_sync('workspace.json'));

	this.projects = {};

}).extend({

	// Stores instances of projects
	projects: null,

	load: function()
	{
	var
		config = this.config
	;
		config.env = process.env;
		config.projects= this.find_projects();

		return config;
	},

	/**
	 * GET Request.
	 *
	 * q: Arguments
	 * c: Command
	 */
	handle_shell: function(req, res)
	{
	var
		me = this,
		query = req.body.q,
		command, process
	;
		if (!req.body.c)
			return res.send(this.error('shell: Invalid command.'));

		command = req.body.c + (query ? ' ' + query.join(' ') : '');

		this.log('shell: ' + command);
		process = require('child_process').spawn(
			req.body.c, req.body.q,
			{ cwd: req.body.p, detached: true, stdio: [ 'ignore' ] }
		);
		process.on('error', function(err) {
			me.error(err);
		});
		process.stdout.on('data', function(data) {
			if (!res.headersSent)
				res.writeHead(200);
			res.write(data);
		});
		process.stderr.on('data', function(data) {
			if (!res.headersSent)
				res.writeHead(500);
			res.write(data);
		});
		process.on('close', function(code) {
			res.end();
			me.log('shell: ' + command + ' returned with status ' + code);
		});
		process.unref();
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
				res.status(result.success ? 200: 403).send(result);
			}
		);
	},

	error: function(err)
	{
		console.error(colors.red('[workspace] ERROR ' + err));
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
		if (query.n && fs.existsSync(fn))
		{
			this.log('Opening file: ' + fn);
			result.stat = fs.statSync(fn);
			result.directory = result.stat.isDirectory();

			result.content = result.directory ?
				fs.readdirSync(fn)
			:
				result.content = fs.readFileSync(fn, 'utf8')
			;
		} else
		{
			result.content = '';
			result.new = true;
		}

		result.filename = path.normalize(query.n);
		result.path = query.p;
		result.mime = mime.lookup(fn);
		result.success = true;

		callback(result);
	},

	find_tags: function(project)
	{
		project.tags = {
			git: fs.existsSync(project.path+'/.git'),
			npm: !!project.package,
			ide: !!project.project
		};
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
				package: common.load_json_sync(path+'/package.json'),
				project: common.load_json_sync(path+'/project.json')
			};

			this.find_tags(projects[path]);
		}

		return projects;
	},

	load_project: function(name)
	{
	var
		me = this,
		project = name ? me._projects[name] : me
	;
		return new Q(function(resolve) {
			if (project)
				resolve(project);
			else {
				project = me._projects[name] = new Project(name, me);
				project.load().then(resolve);
			}
		});
	}

})

.use(cxl.static('public', { maxAge: 86400000 }))
.use(cxl.static('bower_components', { maxAge: 86400000 }))

.route('GET', '/home', function(req, res)
{
	res.send(this.load());
})
.route('GET', '/project', function(req, res)
{
	this.load_project(req.query.n).then(function(project)
	{
		res.send(project.to_json());
	});
})
;
