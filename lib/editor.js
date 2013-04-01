
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

		console.log('Loading project.json');
		this.config = require(dir + '/project.json');		
		
		if (!this.config.ignore)
			this.config.ignore = [];
	}
;

extend(Project.prototype, {

	get_file: function(fn)
	{
		console.log('Opening file: ' + fn);
		return fs.readFileSync(fn, 'utf8');
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

