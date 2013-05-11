
var
	fs = require('fs')
;

exports.extend = function(obj, p)
{
	for (var i in p)
		obj[i] = p[i];
};

exports.load_json = function(filename)
{
var
	result
;
	if (fs.existsSync(filename))
		result = JSON.parse(fs.readFileSync(filename, 'utf8'));

	return result;
};
	

