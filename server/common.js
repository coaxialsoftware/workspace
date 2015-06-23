
"use strict";

var
	fs = require('fs'),
	Q = require('bluebird'),

	common
;

common = module.exports = {

	readFile: Q.promisify(fs.readFile),
	readDirectory: Q.promisify(fs.readdir),
	writeFile: Q.promisify(fs.writeFile),
	stat: Q.promisify(fs.stat),

	sendError: function(module, res, status)
	{
		return function(err)
		{
			module.error(err);
			res.status(status || 500).send({ error: err.toString() });
		};
	},

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
	walk: function(dir, ignore, done, path)
	{
		var results = [];
		path = path || '';

		fs.readdir(dir, function(err, list)
		{
			if (err) return done(err);
			var pending = list.length;

			if (!pending) return done(null, results);

			list.forEach(function(file) {

				if (ignore && ignore(file))
				{
					if (!--pending) done(null, results);
					return;
				} else
				{
					let relfile = path + file;
					file = dir + '/' + file;
					fs.stat(file, function(err, stat) {

						if (stat && stat.isDirectory())
						{
							results.push(relfile + '/');
							common.walk(file, ignore, function(err, res) {
								results = results.concat(res);
								if (!--pending) done(null, results);
							}, relfile + '/');
						} else {
							results.push(relfile);
							if (!--pending) done(null, results);
						}
					});
				}
			});
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
