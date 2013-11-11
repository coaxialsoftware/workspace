
var
	fs = require('fs')
;

exports.extend = function(obj, p)
{
	for (var i in p)
		obj[i] = p[i];
};

exports.load_json = function(filename, callback)
{
	if (callback)
		fs.readFile(filename, 'utf8', function(err, data) {
			callback(err ? undefined : JSON.parse(data));
		});
	else if (fs.existsSync(filename))
		return JSON.parse(fs.readFileSync(filename, 'utf8'));
};


