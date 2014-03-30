
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
			callback(err ? false : JSON.parse(data));
		});
	else
		return fs.existsSync(filename) ?
			JSON.parse(fs.readFileSync(filename, 'utf8')) :
			false
		;
};


