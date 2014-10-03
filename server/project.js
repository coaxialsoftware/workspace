var
	fs = require('fs'),
	minimatch = require('minimatch'),

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

	loadIgnore: function(config)
	{
		if (!config.ignore)
		{
			if (fs.existsSync(this.path + '/.gitignore'))
			{
				config.ignore = '+(' +
					fs.readFileSync(this.path + '/.gitignore', 'utf8')
					.replace(/\n/g, '|')
					.replace(/\/\s*|/g, '')
					+ ')'
				;
			} else
				config.ignore = 'git svn node_modules bower_components';
		}

		this.ignore = new minimatch.Minimatch(config.ignore);
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

			if (ignore && ignore.match(file))
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

