var
	fs = require('fs'),
	Q = require('bluebird'),

	common = require('./common.js'),

	CONFIG_FILES = /bower\.json|package\.json|project\.json/,

	Project = exports.Project = function(path, editor)
	{
		this.path = this.name = path;
		this.editor = editor;
	}
;

common.extend(Project.prototype, {

	load_config: function(file)
	{
		return common.load_json(file).bind(this).then(function(json) {
			this.log('Loading config file: ' + file);
			common.extend(this.config, json);
		});
	},

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
		var config = this.config;

		if (!config.ignore)
			config.ignore = [ '.?*', 'node_modules', 'bower_modules' ];

		return this.load_ignore_file(this.path + '/.gitignore', config.ignore)
			.bind(this)
			.then(function()
			{
				if (config.ignore instanceof Array)
				{
					config.ignore_regex = '^(' + config.ignore
						.join('|')
						.replace(/\./g, "\\.")
						.replace(/\?/g, ".?")
						.replace(/\*/g, '.*')
						.replace(/\/\s*\|/g, '|')
						.replace(/\/$/, '')
						.replace(/[-[\]{}()+,^$#\s]/g, "\\$&") +
						')'
					;
				}
				this.ignore = new RegExp(config.ignore_regex);
			}
		);
	},

	on_filechange: function(ev, file)
	{
		if (ev==='rename' && !this.ignore.test(file))
		{
			this.log('File ' + file + ' changed. Rebuilding project files.');
			this.load_files();
		}

		if (CONFIG_FILES.test(file))
		{
			this.log('Configuration file ' + file + ' changed. Rebuilding.');
			this.load_config_files();
		}
	},

	load_files: function()
	{
		this.log('Loading project files');
		var config = this.config;

		return this.files().then(function(files) {
			config.files = files;
		});
	},

	load_config_files: function()
	{
	var
		config = this.config = {},
		defaults = this.editor.config.project_defaults
	;
		if (defaults)
		{
			this.log('Loading default settings from workspace.');
			common.extend(this.config, defaults);
		}

		config.env = process.env;
		config.path = this.path;

		return this.load_config(this.path + '/bower.json')
			.bind(this)
			.then(this.load_config.bind(this, this.path + '/project.json'))
			.then(this.load_config.bind(this, this.path + '/package.json'))
		;
	},

	load: function()
	{
		if (!this.watcher)
			this.watcher = fs.watch(this.path, this.on_filechange.bind(this));

		return this.load_config_files().then(this.load_ignore)
			.then(this.load_files)
			.then(function()
			{
				this.log("Loading complete.");
				if (!this.config.name) this.config.name = this.config.path;
				return this;
			});
	},

	log: function(msg)
	{
		console.log("[" + this.name + '] ' + msg);
	},

	error: function(msg)
	{
		console.error("[" + this.name + '] ' + msg);
	},

	walk: function(dir, result)
	{
	var
		files = fs.readdirSync(this.path + '/' + dir),
		i, stat, file,
		ignore = this.ignore
	;
		result = result || [];

		for (i=0;i<files.length;i++)
		{
			file = dir + files[i];

			if (ignore.test(file))
				continue;

			result.push(file);

			try {
				stat = fs.statSync(this.path + '/' + file);
				if (stat.isDirectory())
					this.walk(file + '/', result);
			} catch(e)
			{
				this.error(e);
			}
		}

		return result;
	},

	files: function()
	{
		var me = this;

		return new Q(function(resolve) { resolve(me.walk('')); });
	},

	to_json: function()
	{
		return this.config;
	}

});

