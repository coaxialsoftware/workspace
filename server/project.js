var
	fs = require('fs'),
	Q = require('bluebird'),

	common = require('./common.js'),

	Project = exports.Project = function(path, editor)
	{
		this.path = this.name = path;
		this.editor = editor;
	}
;

common.extend(Project.prototype, {

	load_config: function(file)
	{
		this.log('Loading config file: ' + file);

		return common.load_json(file).then(
			common.extend.bind(this, this.config));
	},

	load_ignore_file: function(filename, ignore)
	{
		this.log('Loading ignore file: ' + filename);
		return common.read_if_exists(filename).then(function(list) {
			console.log(list);
			list = list.trim().split("\n");

			list.forEach(function(p) {
				if (ignore.indexOf(p)===-1)
					ignore.push(p);
			});
		});
	},

	load_ignore: function()
	{
		var config = this.config;

		if (!config.ignore)
			config.ignore = [ '.?*' ];

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

	on_filechange: function(ev, file, other)
	{
		this.log(ev, file, other);
		this.load_files();
	},

	load_files: function()
	{
		var config = this.config;

		return this.files().then(function(files) {
			config.files = files;
		});
	},

	load: function()
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

		fs.watch(this.path, this.on_filechange.bind(this));

		config.env = process.env;
		config.path = this.path;

		return this.load_config(this.path + '/project.json')
			.bind(this)
			.then(this.load_config.bind(this, this.path + '/package.json'))
			.then(this.load_ignore)
			.then(this.load_files)
			.then(function()
			{
				this.log("Loading complete.");
				if (!config.name) config.name = config.path;
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

			if (ignore && ignore.test(file))
				continue;

			result.push(file = dir + files[i]);

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

