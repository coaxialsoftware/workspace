var
	fs = require('fs'),
	common = require('./common.js'),

	Project = exports.Project = function(path, editor)
	{
		this.path = this.name = path;
		this.editor = editor;
	}
;

common.extend(Project.prototype, {

	loadConfig: function(file)
	{
		this.log('Loading config file: ' + file);
		common.extend(this.config, common.load_json(file));
	},

	loadIgnoreFile: function(filename, ignore)
	{
		if (fs.existsSync(this.path + '/' + filename))
		{
			var list = fs.readFileSync(this.path + '/.gitignore', 'utf8')
				.trim().split("\n");

			list.forEach(function(p) {
				if (ignore.indexOf(p)===-1)
					ignore.push(p);
			});
		}
	},

	loadIgnore: function(config)
	{
		if (!config.ignore)
			config.ignore = [ '.?*' ];

		this.loadIgnoreFile('.gitignore', config.ignore);

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
	},

	load: function(callback)
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

		this.loadConfig(this.path + '/project.json');
		this.loadConfig(this.path + '/package.json');

		this.loadIgnore(config);

		config.files = this.files();
		config.env = process.env;
		config.path = this.path;

		if (!config.name) config.name = config.path;
		if (callback)
			callback(this);

		return this;
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
		return this.walk('');
	},

	to_json: function()
	{
		return this.config;
	}

});

