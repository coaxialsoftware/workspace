
var
	fs = require('fs'),
	extend = function(obj, p)
	{
		for (var i in p)
			obj[i] = p[i];
	},

	Project = exports.Project = function(dir)
	{
	var
		config = this.config = {}
	;
		this.path = dir;

		console.log('Loading global settings.');
		extend(config, this.load_json('~/.editor.js/config.json'));
		console.log('Loading settings from project.json');
		extend(config, this.load_json(dir + '/project.json'));	
		console.log('Loading settings from package.json');
		extend(config, this.load_json(dir + '/package.json'));
		
		if (!config.ignore)
			config.ignore = [];
	}
;

extend(Project.prototype, {

	load_json: function(filename)
	{
	var
		result
	;
		if (fs.existsSync(filename))
			result = JSON.parse(fs.readFileSync(filename, 'utf8'));

		return result;
	},
	
	get_file: function(fn)
	{
	var
		result = { }
	;
		if (fs.existsSync(fn))
		{
			console.log('Opening file: ' + fn);
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
	var
		config = this.config
	;
		config.files = this.files();

		return config;
	}

});

