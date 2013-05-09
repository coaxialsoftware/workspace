var
	fs = require('fs'),
	common = require('./common.js'),

	Project = function(path)
	{
		this.path = path;
	}
;

common.extend(Project.prototype, {
	
	load: function()
	{
	var
		config = this.config = {}
	;
		console.log('Loading settings from project.json');
		extend(config, common.load_json(this.path + '/project.json'));	
		console.log('Loading settings from package.json');
		extend(config, common.load_json(this.path + '/package.json'));
		
		if (!config.ignore)
			config.ignore = [];

		config.files = this.files();
		config.env = process.env;
	
		return config;
	},

	get_file: function(fn)
	{
	var
		result = { }
	;
		if (fs.existsSync(fn))
		{
			console.log('Opening file: ' + fn);
			result.stat = fs.statSync(fn);
			if (result.stat.isDirectory())
				result.content = fs.readdirSync(fn);
			else
				result.content = fs.readFileSync(fn, 'utf8');
		} else
		{
			result.content = '';
			result.new = true;
		}

		result.filename = fn;

		return result;
	},
	
	put_file: function(fn, data)
	{
		console.log('Writing ' + fn + '(' + data.length + ')');
		return fs.writeFileSync(fn, data);
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

			if (this.config.ignore.indexOf(file)===-1)
			{
				result.push(file = dir + files[i]);

				stat = fs.statSync(this.path + '/' + file);
				if (stat.isDirectory())
					this.walk(file + '/', result);
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

