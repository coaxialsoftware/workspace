
"use strict";

var
	fs = require('fs'),
	cp = require('child_process'),
	path = require('path'),
	Q = Promise,

	micromatch = require('micromatch'),
	mime = require('mime'),
	npm = require('npm')
;

mime.default_type = 'text/plain';

class AuthenticationAgent {

	isAuthenticated() { throw "Not Implemented"; }
	onRequest(/*req, res, next*/) { throw "Not Implemented"; }
	onSocketRequest(/*re*/) { throw "Not Implemented"; }

}

class WorkspaceError extends Error {

	constructor(message, status)
	{
		super(message);
		this.status = status;
	}

}

/**
 * Options
 *
 * onUpdate   Callback function.
 */
class Configuration {

	constructor(defaults)
	{
		this.$ = 0;
		this.update = cxl.debounce(() => {
			this.$++;
			if (this.onUpdate)
				this.onUpdate();
		}, 500);

		if (defaults)
			this.set(defaults);
	}

	// TODO add checks in debug module
	set(key, value)
	{
		if (typeof(key)==='object')
			Object.assign(this, key);
		else
			this[key] = value;

		return this.update();
	}

	/**
	 * Will extend configuration, it will not override array or objects.
	 */
	extend(obj)
	{
		ide.extend(this, obj);
		return this.update();
	}

	/**
	 * Loads a JSON configuration file. Uses extend method to set properties.
	 */
	loadFile(fn, required)
	{
		var obj;

		try {
			obj = JSON.parse(fs.readFileSync(fn, 'utf8'));
		} catch(e) {
			obj = null;
		}

		if (obj)
			this.extend(obj);
		else if (required)
			throw `Could not read JSON file ${fn}`;

		return obj;
	}

}

class FileStat {

	constructor(stat)
	{
		if (stat)
		{
			this.atime = stat.atime;
			this.ctime = stat.ctime;
			this.mtime = stat.mtime;
			this.size = stat.size;
			this.isDirectory = stat.isDirectory();
			this.isSymbolicLink = stat.isSymbolicLink();
		} else
		{
			this.isDirectory = false;
			this.isSymbolicLink = false;
		}

		this.isNew = !stat;
	}

}

// TODO remove this
function respondStat(dir, file)
{
	return cxl.file.stat(dir + '/' + file).then(function(stat) {
		return {
			filename: file,
			// TODO
			mime: stat.isDirectory() ? 'text/directory' : mime.lookup(file)
		};
	}, function(err) {
		return {
			filename: file,
			error: err.cause.code
		};
	});
}

class File {

	static mime(file, stat)
	{
		// TODO add typescript support
		return stat && stat.isDirectory ? 'text/directory' : mime.lookup(file);
	}

	/**
	 * Creates a File from socket data.
	 */
	static fromSocket(data)
	{
		var file = new File(data.id);

		return file.read().then(function(file) {
			if (data.diff)
				File.patch(file.content, data.diff);

			return file;
		});
	}

	/**
	 * Lists files and folders under dir, an optional ignore function
	 * can be passed.
	 */
	static list(dir, ignore)
	{
		return cxl.file.readDirectory(dir).then(function(list) {
			return Promise.all(list.reduce(function(result, file) {

				if (!(ignore && ignore(file)))
					result.push(respondStat(dir, file));

				return result;

			}, []));

		});
	}

	static patch(A, diff)
	{
	var
		i, cursor=0, result=''
	;
		for (i=0; i<diff.length; i+=3)
		{
			result += A.substr(cursor, diff[i+1]) + diff[i];
			cursor += diff[i+1] + diff[i+2];
		}

		if (cursor < A.length)
			result += A.substr(cursor);

		return result;
	}

	/**
	 * @return {FileStat}
	 */
	static stat(path)
	{
		return new Promise((resolve, reject) => {
			fs.stat(path, (err, stat) => {
				if (err && err.code !== 'ENOENT')
					return reject(err);

				return resolve(new FileStat(stat));
			});
		});
	}

	/**
	 * @param filepath Path relative to workspace
	 */
	constructor(filepath)
	{
		this.path = path.normalize(filepath);
	}

	/**
	 * Reads file with optional encoding. If encoding not passed it will return a Buffer
	 */
	read(encoding)
	{
		return File.stat(this.path).then(stat => {
			this.stat = stat;
			this.encoding = encoding;

			if (stat.isNew)
				return '';

			return stat.isDirectory ?
				File.list(this.path) :
				cxl.file.read(this.path, encoding);
		}).then(content => {
			this.content = content;
			this.mime = File.mime(this.path, this.stat);
			return this;
		});
	}

	delete()
	{
		return cxl.file.unlink(this.path).then(this.read.bind(this));
	}

	write(content)
	{
		this.content = content;

		ide.plugins.emit('file.beforewrite', this);

		return cxl.file.write(this.path, this.content)
			.then(() => {
				ide.plugins.emit('file.write', this);
				return this.read();
			});
	}

}

class FileWalker {

	constructor(path, ignore)
	{
		this.root = path;
		this.ignore = ignore;
	}

	serialize(file, stat)
	{
		// TODO make file objects more consistent
		return { filename: file, directoy: stat.isDirectory() };
	}

	$recursiveWalk(dir)
	{
		var fullpath = path.join(this.root, dir);

		fs.readdir(fullpath, (err, list) => {
			// Ignore Errors
			if (!err)
				list.forEach(file => {

					let relfile = path.join(dir, file);

					if (!this.ignore || !this.ignore(file))
					{
						this.$pending++;
						fs.stat(path.join(this.root, relfile), (err, stat) => {
							if (!err)
							{
								if (stat.isDirectory())
									this.$recursiveWalk(relfile);

								this.$results.push(this.serialize(relfile, stat));
							}

							if (!--this.$pending) this.$resolve();
						});
					}
				});

			if (!this.$pending) this.$resolve();
		});
	}

	walk()
	{
		// TODO add reject condition
		return this.$promise || (this.$promise = new Promise((resolve) => {
			this.$results = [];
			this.$resolve = function() {
				this.$promise = null;
				resolve(this.$results);
			};
			this.$pending = 0;
			this.$recursiveWalk('');
		}));
	}

}

class FileMatcher {

	static isMatch(path, match)
	{
		return micromatch.isMatch(path, match);
	}

	constructor(files)
	{
		this.files = [];

		if (files)
			this.push(files);
	}

	push(files)
	{
		if (Array.isArray(files))
			files.forEach(this.push, this);
		else if (this.files.indexOf(files)===-1)
		{
			this.files.push(files);
			this.dirty = true;
		}
	}

	matcher(path)
	{
		return micromatch.any(path, this.files);
	}

	build()
	{
		if (this.dirty && this.files.length)
		{
			this.source = '^' +
				this.files.map(function(glob) {
				try {
					var regex = micromatch.makeRe(glob).source;
					return regex.substr(1, regex.length-2);
				} catch(e) {
					this.error(`Invalid ignore parameter: "${glob}"`);
				}
			}, this).join('|');
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

function FileWatcher(options)
{
	Object.assign(this, options);

	if (typeof(this.paths)==='string')
		this.paths = [ path ];

	this.watchers = {};
	this.events = {};
	this.observers = [];

	if (this.base)
		this.watchPath('.');

	if (this.paths)
		this.paths.forEach(this.watchPath.bind(this));
}

Object.assign(FileWatcher.prototype, {

	/** @required */
	paths: null,
	delay: 250,
	ignore: null,
	watchers: null,
	events: null,
	base: null,

	onEvent: null,

	trigger: function(id, ev, file, full)
	{
		delete this.events[id];

		fs.stat(full, (err, s) => {
			if (err)
				ev = ev==='change' || ev==='rename' ? 'remove' : 'error';

			if (this.onEvent)
				this.onEvent(ev, file, full, s);

			this.observers.forEach(o => {
				if (o.fileId === id)
					o.next(ev);
			});
		});

	},

	onWatch: function(dir, ev, filename)
	{
		if (!filename)
			return;
	var
		full = path.join(dir, filename),
		rel = this.base ? path.relative(this.base, full) : full,
		id = ev + ' ' + rel,
		timeout = this.events[id]
	;
		if (this.ignore && this.ignore(rel))
			return;
		if (timeout !== undefined)
			clearTimeout(timeout);

		this.events[id] = setTimeout(
			this.trigger.bind(this, id, ev, rel, full), this.delay);
	},

	onError: function()
	{
		console.log(arguments);
	},

	reset: function()
	{
		cxl.invokeMap(this.watchers, 'close');
		this.watchers = {};
	},

	getId: function(p)
	{
		return this.base ? path.join(this.base, p) : p;
	},

	observeFile: function(f, subscriber)
	{
	var
		id = this.watchFile(f),
		subscription = new cxl.rx.Subscriber(subscriber, null, null, () => {
			this.unwatch(id);
		})
	;
		subscription.fileId = id;
		this.observers.push(subscription);

		return subscription;
	},

	watchFile: function(f)
	{
	var
		full = path.normalize(f),
		id = this.getId(full),
		dir = path.dirname(id)
	;
		return this._doWatch(id, dir);
	},

	isWatching: function(file)
	{
		var id = this.getId(path.normalize(file));

		return !!this.watchers[id];
	},

	unwatch: function(id)
	{
		if (this.watchers[id])
		{
			this.watchers[id].close();
			delete this.watchers[id];
		}
	},

	_doWatch: function(id, dir)
	{
		if (this.watchers[id])
		{
			return id;
		}

		try {
			var w = fs.watch(id);
			w.on('change', this.onWatch.bind(this, dir));
			w.on('error', this.onError.bind(this, dir));

			this.watchers[id] = w;
			return id;
		} catch(e) {
			console.error(e);
		}
	},

	watchPath: function(p)
	{
		var id = this.getId(p);

		return this._doWatch(id, id);
	}

});

class FileManager {

	constructor(p)
	{
		this.path = p.path;
		this.ignore = p.ignore;
		this.onEvent = p.onEvent;
		this.recursive = p.recursive!==false;
	}

	onWalk(resolve, reject, data)
	{
		this.building = false;

		// TODO see if we can make it in one pass.
		data.forEach(function(f) {
			f.mime = f.directory ? 'text/directory' : mime.lookup(f.filename);
		});

		this.files = data;

		this.watchFiles();

		resolve(data);
	}

	build()
	{
		var walker = new FileWalker(this.path, this.ignore);

		this.building = true;
		return new Q((resolve, reject) => {
			var fn = this.onWalk.bind(this, resolve, reject);

			walker.walk().then(fn);
		});
	}

	onWatch(ev, filepath, fullpath, stat)
	{
		this.onEvent(ev, filepath, fullpath, stat);
	}

	watchFiles()
	{
		var files = this.files.reduce(function(a, f) {
			if (f.mime==='text/directory');
				a.push(f.filename);
			return a;
		}, []);

		if (this.watcher)
			this.watcher.reset();

		this.watcher = new FileWatcher({
			base: this.path,
			ignore: this.ignore,
			paths: files,
			onEvent: this.onWatch.bind(this)
		});
	}
}


class AssistServer {

	static CanAssistMime(mimeRegex) {
		return function(request)
		{
			return request.features.file && mimeRegex.test(request.features.file.mime);
		};
	}

	constructor()
	{
		ide.plugins.on('assist', this.$onAssist.bind(this));
	}

	/** @abstract */
	canAssist() {}

	/** @abstract */
	onAssist() {}

	$doInline(req)
	{
		var hints = this.inlineAssist(req, req.respondInline.bind(req));

		if (hints)
			req.respondInline(hints);
	}

	$doExtended(req)
	{
		var hints = this.extendedAssist(req, req.respondExtended.bind(req));

		if (hints)
			req.respondExtended(hints);
	}

	$onAssist(request)
	{
		if (this.canAssist(request))
		{
			this.onAssist(request);

			if (request.features.token && this.inlineAssist)
				this.$doInline(request);
			if (request.extended && this.extendedAssist)
				this.$doExtended(request);
		}
	}

}

class JSONRPC {

	constructor(read, write)
	{
		this.$read = read;
		this.$write = write;
		this.$ = 0;
		this.$requests = {};
		this.$buffer = '';

		this.$read.on('data', this.$onResponse.bind(this));
	}

	request(method, params)
	{
	var
		id = this.$++,
		stdin = this.$write,
		data = {
			jsonrpc: "2.0",
			method: method,
			params: params,
			id: id
		},
		json = JSON.stringify(data),
		length = json.length,
		promise = new Promise((resolve, reject) => {
			this.$requests[id] = { resolve: resolve, reject: reject };
			stdin.write('Content-Length: ' + length + "\r\n\r\n" + json, 'utf8');
		})
	;
		return promise;
	}

	$onResponse(data)
	{
		this.$buffer = data = this.$buffer + data.toString();
	var
		match = data.match(/Content-Length:\s+(\d+)(?:.*)\r\n\r\n(.+)/),
		length, json, response, request
	;
		if (!match)
			return;

		length = match[1];
		response = match[2];

		if (length < response.length)
			return;

		json = JSON.parse(response.slice(0, length));
		this.$buffer = response.slice(length);

		if (json.id!==undefined)
		{
			request = this.$requests[json.id];

			if (json.result)
				request.resolve(json.result);
			else if (json.error)
				request.reject(json.error);
		}
		// TODO handle notification messages
	}

}

class ServerResponse
{
	static respond(res, promise, module)
	{
		var r = new this(res, module);

		return r.respond(promise);
	}

	constructor(res, module)
	{
		this.res = res;
		this.module = module;
	}

	respond(promise)
	{
		return Promise.resolve(promise)
			.then(this.$send.bind(this), this.$onError.bind(this));
	}

	$send(content)
	{
		this.res.send(content);
	}

	$getErrorStatus(err)
	{
		if (!err)
			return 500;

		switch (err.code) {
		case 'ENOENT': return 404;
		case 'EACCES': return 403;
		default: return err.status || 500;
		}

	}

	$onError(err)
	{
		var status = this.$getErrorStatus(err);
		this.module.error(err);
		this.res.status(status).send(err);
	}
}

/*class Resource
{
	resource(r)
	{
		this.$resources = r;
	}

	destroy()
	{
		cxl.invokeMap(this.$resources, 'destroy');
	}
}*/

class Theme
{
	constructor(p)
	{
		this.path = path.isAbsolute(p) ? p :
			ide.basePath + '/public/theme/' + p + '.css';

		this.observer = ide.fileWatcher.observeFile(this.path, this.onWatch.bind(this));
	}

	onWatch()
	{
		this.load().then(function() {
			ide.plugins.emit('themes.reload:' + this.path, this);
		});
	}

	toJSON()
	{
		return this.source;
	}

	load()
	{
		return cxl.file.read(this.path, 'utf8').then(src =>
		{
			this.source = src.replace(/\n/g,'');
			return this;
		});
	}

}

class LanguageServerStdIO extends AssistServer {

	constructor(plugin, binPath, canAssist)
	{
		super();
		this.plugin = plugin;
		this.binPath = binPath;
		this.ready = false;
		this.$canAssist = canAssist;
	}

	canAssist(request)
	{
		return this.ready && this.$canAssist(request);
	}

	requestCompletion(request)
	{
	var
		token = request.features.token
	;
		return this.jsonrpc.request('textDocument/completion', {
			textDocument: {
				uri: this.uri(request)
			},
			position: {
				line: token.row,
				character: token.column
			}
		}).then(result => {
			console.log(result);
		});
	}

	uri(request)
	{
		return 'file:' + path.resolve(request.features.file.path);
	}

	inlineAssist(request)
	{
	var
		features = request.features,
		file = features.file
	;
		if (file.diffChanged)
			this.jsonrpc.request('textDocument/didOpen', {
				textDocument: {
					uri: this.uri(request),
					version: 0,
					text: file.content,
					languageId: 'javascript'
				}
			}).then(this.requestCompletion.bind(this, request));
		else
			this.requestCompletion(request);
	}

	/*extendedAssist(request)
	{
	}*/

	$initialize()
	{
		return this.jsonrpc.request('initialize', {
			processId: process.pid,
			rootUri: 'file:/' + ide.cwd,
			capabilities: {
				/*workspace: {
					applyEdit: true,
					symbol: {
						dynamicRegistration: true
					},
					executeCommand: {
						dynamicRegistration: true
					}
				},*/
				textDocument: {
					completion: {}
				}
			},
			trace: ide.configuration.debug ? 'verbose' : 'off'
		}).then(response => {
			this.supportedCapabilities = response;
			this.ready = true;
		});
	}

	$onError(data)
	{
		this.plugin.error(data.toString());
	}

	$onClose(code, signal)
	{
		this.plugin.error(`Process closed ${code} ${signal}`);
	}

	start()
	{
		if (this.cp)
			return;

		// TODO get node executable
		var ls = this.cp = cp.spawn(process.execPath, [ this.binPath ]);

		this.jsonrpc = new JSONRPC(ls.stdout, ls.stdin);

		ls.on('close', this.$onClose.bind(this));
		ls.on('error', this.$onError.bind(this));

		ls.stderr.on('data', this.$onError.bind(this));

		return this.$initialize();
	}

}

class LanguageServer extends AssistServer {

	constructor(pluginName, mimeMatch, fileMatch)
	{
		super();
		ide.plugins.on('assist.inline', this.$onInlineAssist.bind(this));

		this.$plugin = pluginName;
		this.$mime = mimeMatch;
		this.$fileMatch = fileMatch;
	}

	onInlineAssist()
	{
	}

	canAssist(data)
	{
	var
		project = data.project,
		file = data.features.file
	;
		return file && project.hasPlugin(this.$plugin) &&
			(!this.$mime || this.$mime.test(file.mime)) &&
			(!this.$fileMatch || this.$fileMatch.test(file.path));
	}

	$onInlineAssist(done, data)
	{
		if (this.canAssist(data))
			this.onInlineAssist(done, data);
	}

}

module.exports = {

	AuthenticationAgent: AuthenticationAgent,
	AssistServer: AssistServer,
	Configuration: Configuration,

	LanguageServer: LanguageServer,
	LanguageServerStdIO: LanguageServerStdIO,
	ServerResponse: ServerResponse,
	Theme: Theme,

	Error: WorkspaceError,

	File: File,
	FileWatcher: FileWatcher,
	FileMatcher: FileMatcher,
	FileManager: FileManager,
	FileWalker: FileWalker,

	basePath: path.resolve(__dirname + '/../'),
	cwd: process.cwd(),

	NPM: {

		/** Calls npm and returns a promise with the result */
		doNpm(cmd, args, cwd)
		{
			args = args || [];

			return this.load(cwd).then(function(npm) {
				return new Promise(function(resolve, reject) {
					try {
						cwd = cwd ? path.resolve(cwd) :
							ide.configuration['plugins.path'] || ide.cwd;

						args.push(function(er, data) {
							if (er)
								return reject({
									error: er,
									data: data
								});

							resolve(data);
						});

						npm.prefix = cwd;
						npm.commands[cmd].apply(npm.commands, args);
					}
					catch(e) { reject(e); }
				});
			});
		},

		load: function()
		{
			return new Promise(function(resolve, reject) {
				npm.load(function(er, npm) {
					if (er)
						return reject(er);

					try {
						npm.config.set('json', true);
						npm.config.set('depth', 0);
						resolve(npm);
					}
					catch(e) { reject(e); }
				});
			});
		},

		install: function(module)
		{
			return this.doNpm('install', [ [ module ] ]).then(function(a) {
				return a[0][1];
			});
		},

		uninstall: function(module)
		{
			return this.doNpm('uninstall', [ [ module ] ]);
		}

	},

	// TODO move to shared
	assist: {

		match: function(term, cursorValue, prefix)
		{
			var index = term.indexOf(cursorValue);

			if (index!==-1)
				return {
					title: prefix ? prefix + term : term,
					matchStart: index,
					matchEnd: index+cursorValue.length,
					priority: index
				};
		},

		findObject: function(obj, cursorValue, fn)
		{
			var i, result=[], match;

			for (i in obj)
				if ((match = this.match(i, cursorValue)))
				{
					if (fn)
						match = fn(match, obj[i], i, cursorValue);
					if (match)
						result.push(match);
				}

			return result;
		},

		findArray: function(array, cursorValue, fn)
		{
			var i=0, l=array.length, result=[], match, value=cursorValue.trimLeft(), prefix;

			if (value!==cursorValue)
				prefix = cursorValue;

			for (;i<l;i++)
				if ((match = this.match(array[i], value, prefix)))
				{
					if (fn)
						match = fn(match, array[i], i, value);
					if (match)
						result.push(match);
				}

			return result;
		}

	},

	registerAuthenticationAgent(Agent)
	{
		this.authenticationAgent = new Agent();
	},

	/**
	 * Executes shell command using child_process.exec. Returns a promise
	 *
	 * options:
	 *
	 * timeout  Default 5 seconds.
	 */
	exec: function(command, options)
	{
		return new Q(function(resolve, reject) {
			options = Object.assign({
				timeout: 5000,
				plugin: ide.module
			}, options);

			options.plugin.dbg(`${options.cwd ? '[cwd:'+options.cwd+'] ' : '' }exec "${command}"`);

			cp.exec(command, options, function(err, stdout, stderr) {
				if (err && err.code!==0)
				{
					options.plugin.error(err);
					options.plugin.dbg(stderr);
					options.plugin.dbg(stdout);
					return reject(err);
				}

				resolve(stdout);
			});
		});
	},

	/*shell: function(command, params, cwd, res)
	{
		var me = this;

		this.log(command + (params ? ' ' + params.join(' ') : ''));

		var process = cp.spawn(
			command, params,
			{ cwd: cwd, detached: true, stdio: [ 'ignore' ] }
		);
		process.on('error', this.error.bind(this.log));
		process.on('close', function(code) {
			me.log(command + ' returned with status ' + code);

			if (res)
				res.end();
		});

		if (res)
		{
			process.stdout.on('data', function(data) {
				if (!res.headersSent)
					res.writeHead(200);
				res.write(data);
			});
			process.stderr.on('data', function(data) {
				if (!res.headersSent)
					res.writeHead(500);
				res.write(data);
			});
		}

		process.unref();

		return process;
	},*/

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
					cxl.pushUnique(c, val);
				else
					c.push(val);
			} else if (c && typeof(c)==='object' && val && typeof(val)==='object')
				extend(c, val);
			else
				obj[i] = p[i];
		}

		return obj;
	}

};
