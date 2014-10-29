
var
	fs = require('fs'),
	Q = require('bluebird')
;

exports.extend = function extend(obj, p)
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
};

exports.extend(exports, {

	read: function(filename)
	{
		return new Q(function(resolve, reject) {
			fs.readFile(filename, 'utf8', function(err, data) {
				if (err)
					reject(err);
				else
					resolve(data);
			});
		});
	},

	load_json: function(filename)
	{
		return exports.read(filename).then(JSON.parse).catch(function() { });
	},

	load_json_sync: function(filename)
	{
		if (fs.existsSync(filename))
			return JSON.parse(fs.readFileSync(filename));
	}
});



