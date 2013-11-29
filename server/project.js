var
	fs = require('fs'),
	common = require('./common.js'),

	Project = exports.Project = function(path)
	{
		this.path = this.name = path;
	}
;

common.extend(Project.prototype, {

	load: function()
	{
	var
		config = this.config = {}
	;
		this.log('Loading global settings...');
		common.extend(config, common.load_json('~/.ide.js/config.json'));
		this.log('Loading settings from project.json');
		common.extend(config, common.load_json(this.path + '/project.json'));
		this.log('Loading settings from package.json');
		common.extend(config, common.load_json(this.path + '/package.json'));

		if (!config.ignore)
			config.ignore = [];

		config.files = this.files();
		config.env = process.env;
		config.path = this.path;

		if (!config.name) config.name = config.path;

		return config;
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
		i, stat, file
	;
		result = result || [];

		for (i=0;i<files.length;i++)
		{
			file = dir + files[i];

			if (this.config.ignore.indexOf(file)!==-1)
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
		return this.load();
	}

});

