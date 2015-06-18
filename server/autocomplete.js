

	load_ignore_file: function(filename, ignore)
	{
		this.log('Loading ignore file: ' + filename);
		return common.read(filename).then(function(list) {
			list = list.trim().split("\n");

			list.forEach(function(p) {
				if (ignore.indexOf(p)===-1)
					ignore.push(p);
			});
		}).error(function() { });
	},

	load_ignore: function()
	{
		if (!this.ignore)
			this.ignore = [ '.?*', 'node_modules', 'bower_modules' ];

		return this.load_ignore_file(this.path + '/.gitignore', this.ignore)
			.bind(this)
			.then(function()
			{
				if (this.ignore instanceof Array)
				{
					this.ignoreRegex = '^(' + this.ignore
						.join('|')
						.replace(/\./g, "\\.")
						.replace(/\?/g, ".?")
						.replace(/\*/g, '.*')
						.replace(/\/\s*\|/g, '|')
						.replace(/\/$/, '')
						.replace(/[-[\]{}()+,^$#\s]/g, "\\$&") +
						')'
					;
				} else
					this.ignoreRegex = new RegExp(this.ignore);
			}
		);
	},

	on_filechange: function(ev, file)
	{
		if (CONFIG_FILES.test(file))
		{
			this.log('Configuration file ' + file + ' changed. Rebuilding.');
			this.load();
		}
		else if (ev==='rename' && !this.ignore.test(file))
		{
			this.log('File ' + file + ' changed. Rebuilding project files.');
			this.load_files();
		}

	},

	load_files: function()
	{
		this.loadingFiles = true;

		return this.files().bind(this).then(function(files) {
			this.files = files;
			this.log(files.length + ' file(s) found.');
		});
	},

	load: function()
	{
		if (!this.watcher)
			this.watcher = fs.watch(this.path, this.on_filechange.bind(this));

		this.env = process.env;

		return this.load_ignore()
			.then(this.load_files)
			.then(function()
			{
				workspace.plugins.emit('project.load', this);

				this.log("Loading complete.");
				return this;
			});
	},

	log: function(msg)
	{
		cxl.log(msg, colors.yellow(this.path));
	},

	error: function(msg)
	{
		cxl.log(msg, this.path, 'error');
	},

	files: function()
	{
	var
		ignore = this.ignore,
		result = []
	;
		return common.walk(this.path, function(path) {
			if (ignore.test(path))
				return;

			result.push(path);
		}).then(function() {
			return result;
		});
	}



module.exports = function(app, editor)
{
var
	Q = require('bluebird'),
	Inference = require('j5g3.inference').Inference,
	mime = require('mime'),

	common = require('./common'),

	handlers = {}
;
	function Javascript() {
		this.data = {};
	}

	Javascript.prototype = {

		data: null,

		compile: function(project)
		{
		var
			promises = [],
			files = project.config.files,
			path = project.path,
			infer = new Inference()
		;
			files.forEach(function(file) {

				var fn = path + '/' + file;

				if (mime.lookup(fn).match(/javascript/))
					promises.push(
						common.read(fn)
							.then(function(src) {
								infer.compile(fn, src);
							})
							.catch(function(err) {
								project.error(err);
							})
					);
			});

			return Q.join.apply(Q, promises)
				.bind(this)
				.then(function() {
					return (this.data[path] = infer);
				}
			);
		},

		find_symbol: function(file, pos/*, infer*/)
		{
			return { file: file, pos: pos };
		},

		query: function(project, file, pos)
		{
		var
			data = this.data[project.path]
		;
			if (data)
				return Q.resolve(this.find_symbol(file, pos, data));

			return this.compile(project)
				.then(this.find_symbol.bind(this, file, pos))
			;
		}

	};

	handlers['application/javascript'] = new Javascript();

	app.get('/autocomplete', function(req, res)
	{
	var
		q = req.query,
		handler = handlers[q.mime]
	;
		if (!handler)
			return res.end();

		editor.load_project(q.project).then(function(project) {

			project.log("[autocomplete] Compiling " + q.mime + " files.");

			if (project.config.files)
				handler.query(project, q.file, q.pos).then(function(result) {
					res.send(result);
				});
			else
				res.end();

		});
	});
};
