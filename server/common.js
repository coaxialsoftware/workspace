
"use strict";

var
	fs = require('fs'),
	Q = require('bluebird'),
	_ = require('lodash'),
	path = require('path'),
	micromatch = require('micromatch'),
	
	Watcher = require('./watcher'),

	common
;

class FileMatcher {
	
	constructor(files)
	{
		this.files = [];
		
		if (files)
			this.push(files);
	}
	
	push(files)
	{
		if (Array.isArray(files))
			this.files = this.files.concat(files);
		else
			this.files.push(files);
		
		this.files = _.uniq(this.files);
		this.dirty = true;
	}
	
	matcher(path)
	{
		return micromatch.any(path, this.files);
	}
	
	build()
	{
		if (this.dirty)
		{
			this.source = '^' + 
				_.map(this.files, function(glob) {
				try {
					var regex = micromatch.makeRe(glob).source;
					return regex.substr(1, regex.length-2);
				} catch(e) {
					this.error(`Invalid ignore parameter: "${glob}"`);
				}
			}, this).join('|') + '$';
			this.dirty = false;
		}
		
		return this.source;
	}
	
	toJSON()
	{
		return this.build();
	}
	
	toRegex()
	{
		return new RegExp(this.build());
	}
}

class FileManager {
	
	constructor(p)
	{
		this.path = p.path;
		this.ignore = p.ignore;
		this.onEvent = p.onEvent;
	}
	
	onWalk(resolve, reject, err, data)
	{
		this.building = false;
		
		if (err)
			return reject(err);

		this.files = data;
		this.watchFiles();
		
		resolve(data);
	}
	
	build()
	{
		this.building = true;
		return new Q((function(resolve, reject) {
			common.walk(this.path, this.ignore,
				this.onWalk.bind(this, resolve, reject));
		}).bind(this));
	}
	
	onWatch(ev, filepath, fullpath, stat)
	{
		if (ev!=='change' && !this.building)
			this.build();

		this.onEvent(ev, filepath, fullpath, stat);
	}
	
	watchFiles()
	{
		var files = _(this.files).filter('directory', true)
			.pluck('filename')
			.value()
		;
		
		if (this.watcher)
			this.watcher.close();
		
		this.watcher = new Watcher({
			base: this.path,
			ignore: this.ignore,
			paths: files,
			onEvent: this.onWatch.bind(this)
		});
	}
}


common = module.exports = {
	
	FileMatcher: FileMatcher,
	FileManager: FileManager,

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
					obj[i] = _.union(c, val);
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
		}, function(err) {
			return {
				filename: file,
				error: err.cause.code
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
	},
	
	/**
	 * Returns a promise that resolves when the object property is set
	 * to something other than undefined|null, optional timeout (default 5000)
	 */
	promiseProp: function(obj, prop, timeout)
	{
		var start = Date.now();
		timeout = timeout || 2000;
		
		return new Q(function(resolve, reject) {
			var check = function() {
				var val = obj[prop];
				
				if (val!==null || val!==undefined)
					return resolve(val);
				
				if (timeout < start-Date.now())
					setTimeout(check);
				else
					reject('Timeout');
			};
		});
	},
	
	promiseCallback: function(fn, timeout)
	{
		timeout = timeout || 2000;
		return new Q(function(resolve, reject) {
			var timeout = setTimeout(reject, timeout);
			
			fn(function(data) {
				clearTimeout(timeout);
				resolve(data);
			});
		});
	}
	
};

