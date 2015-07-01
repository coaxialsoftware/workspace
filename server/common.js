
"use strict";

var
	fs = require('fs'),
	Q = require('bluebird'),
	_ = require('lodash'),
	path = require('path'),

	common
;

common = module.exports = {

	readFile: Q.promisify(fs.readFile),
	readDirectory: Q.promisify(fs.readdir),
	writeFile: Q.promisify(fs.writeFile),
	stat: Q.promisify(fs.stat),
	
	/**
	 * Returns relative path from cwd and an optional project path.
	 */
	relative: function(filepath, project)
	{
		return path.relative(process.cwd() + (project ? '/' + project : ''), filepath);
	},
	
	read: function(filename)
	{
		return common.readFile(filename, 'utf8');
	},
	
	/**
	 * Get diff between A and B
	 */
	diff: function(A, B)
	{
		var result;
		
		for (var i in B)
			if (B[i] !== A[i])
				(result = result || {})[i] = B[i];
		
		return result;	
	},
	
	payload: function(plugin, data)
	{
		return JSON.stringify({ plugin: plugin, data: data });
	},

	respond: function(module, res, promise)
	{
		return promise.then(common.send(res),
			common.sendError(module, res));
	},

	sendError: function(module, res, status)
	{
		return function(err)
		{
			module.error(err);
			res.status(status || 500).send({ error: err.toString() });
		};
	},

	send: function(res)
	{
		return function(result) { res.send(result); };
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

	respondStat: function(dir, file)
	{
		return common.stat(dir + '/' + file).then(function(stat) {
			return {
				filename: file,
				directory: stat.isDirectory()
			};
		});
	},

	sortFiles: function(files)
	{
		return _.sortByOrder(files,
			['directory','filename'], [false, true]);
	},

	/**
	 * Lists files and folders under dir, an optional ignore function
	 * can be passed.
	 */
	list: function(dir, ignore)
	{
		return common.readDirectory(dir).then(function(list) {

			return Q.all(list.reduce(function(result, file) {

				if (!(ignore && ignore(file)))
					result.push(common.respondStat(dir, file));

				return result;

			}, []));

		}).then(common.sortFiles);
	},

	/**
	 * Walks path, executes callback for each path and returns
	 * TODO cleanup
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

				let relfile = path + file;

				if (ignore && ignore(relfile))
				{
					if (!--pending) done(null, results);
					return;
				} else
				{
					file = dir + '/' + file;
					fs.stat(file, function(err, stat) {

						if (stat && stat.isDirectory())
						{
							results.push({
								filename: relfile,
								directory: true
							});

							common.walk(file, ignore, function(err, res) {
								results = results.concat(res);
								if (!--pending) done(null, results);
							}, relfile + '/');
						} else {
							results.push({ filename: relfile });
							if (!--pending) done(null, results);
						}
					});
				}
			});
		});
	},

	load_json: function(filename)
	{
		return common.read(filename).then(JSON.parse).catch(function() { });
	},

	load_json_sync: function(filename)
	{
		try {
			return JSON.parse(fs.readFileSync(filename, 'utf8'));
		} catch(e) {
			return null;
		}
	}
};
