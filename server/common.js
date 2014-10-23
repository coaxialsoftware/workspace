
var
	fs = require('fs'),
	Q = require('bluebird')
;

exports.extend = function(obj, p)
{
	for (var i in p)
		obj[i] = p[i];
};

exports.extend(exports, {

	read_if_exists: function(filename)
	{
		return exports.read(filename).catch(function() {
			return "{}";
		});
	},

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



