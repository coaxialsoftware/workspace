
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
		this.config = require(dir + '/./project.json');		
	}
;

extend(Project.prototype, {

	walk: function(dir, result)
	{
	var
		files = fs.readdirSync(this.path + dir),
		i, stat, file
	;
		result = result || [];

		for (i=0;i<dir.length;i++)
		{
			result.push(file = files[i]);

			stat = fs.statSync(this.path + dir + file);
			if (stat.isDirectory())
				this.walk(dir + file + '/', result);
		}
		return result;
	},

	files: function()
	{
		return this.walk('/');
	},
	
	to_json: function()
	{
		return { 
			files: this.files()
		};
	}

});

