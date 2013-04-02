
var
	fs = require('fs'),
	extend = function(obj, p)
	{
		for (var i in p)
			obj[i] = p[i];
	},

	Project = exports.Project = function(dir)
	{
		this.path = dir;

		console.log('Loading settings from project.json');
		this.config = require(dir + '/project.json');		
		
		if (!this.config.ignore)
			this.config.ignore = [];
	}
;

extend(Project.prototype, {
	
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
		return { 
			files: this.files()
		};
	}

});

