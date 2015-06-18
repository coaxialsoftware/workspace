
var
	fs = require('fs'),
	Q = require('bluebird'),
	cxl = require('cxl'),

	common = module.exports = {

	readFile: Q.promisify(fs.readFile),
	readDirectory: Q.promisify(fs.readdir),

	isDirectory: function(path)
	{
		return fs.statSync(path).isDirectory();
	},

	extend: function extend(obj, p)
	{
		var c, val;

		for (var i in p)
		{
			// Override if property starts with '!'
			if (i[0]==='!')
			{
				i = i.slice(1);
				obj[i] = p[i];
				continue;
			}
			val = p[i];
			c = obj[i];

			if (Array.isArray(c))
			{
				if (Array.isArray(val))
					obj[i] = c.concat(val);
				else
					c.push(val);
			} else if (typeof(c)==='object' && typeof(val)==='object')
				extend(c, val);
			else
				obj[i] = p[i];
		}

		return obj;
	},

	/**
	 * Walks path, executes callback for each path and returns
	 */
	walk: function(path, callback)
	{
		return common.readDirectory(path).then(function(files)
		{
			return Q.all(files.map(function(file) {
				var fn = path + '/' + file;

				return fs.statSync(fn).isDirectory() ?
					common.walk(fn, callback) :
					callback && callback(fs) || fn;
			}));

		}, function(err) {
			console.error(err);
		}).catch(function(err) {
			console.error(err);
		});
	},

	read: function(filename)
	{
		return common.readFile(filename, 'utf8');
	},

	load_json: function(filename)
	{
		return common.read(filename).then(JSON.parse).catch(function() { });
	},

	load_json_sync: function(filename)
	{
		if (fs.existsSync(filename))
			return JSON.parse(fs.readFileSync(filename));
	}
};
