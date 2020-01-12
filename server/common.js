const
	fs = require('fs'),
	cp = require('child_process'),
	path = require('path').posix,
	Q = Promise,

	micromatch = require('micromatch'),
	mime = require('mime'),
	npm = require('npm'),

	FileWatch = require('@cxl/filewatch').FileWatch,
	DirectoryWatch = require('@cxl/filewatch').DirectoryWatch,

	cwd = process.cwd(),

		ENTITIES_REGEX = /[&<>]/g,
		ENTITIES_MAP = {
			'&': '&amp;',
			'<': '&lt;',
			'>': '&gt;'
		}
;

mime.define({ 'application/typescript': [ 'ts' ]}, true);
mime.define({ 'application/x-python': [ 'py' ]}, true);
mime.define({ 'text/jsx': [ 'tsx', 'jsx' ] }, true);

class EventEmitter {
	    on(type, callback, scope) {
		            return this.addEventListener(type, callback, scope);
		        }
	    off(type, callback, scope) {
		            return this.removeEventListener(type, callback, scope);
		        }
	    addEventListener(type, callback, scope) {
		            if (!this.__handlers)
			                this.__handlers = {};
		            if (!this.__handlers[type])
			                this.__handlers[type] = [];
		            this.__handlers[type].push({ fn: callback, scope: scope });
		            return { unsubscribe: this.off.bind(this, type, callback, scope) };
		        }
	    removeEventListener(type, callback, scope) {
		            const handlers = this.__handlers && this.__handlers[type];
		            if (!handlers)
			                throw new Error('Invalid arguments');
		            const h = handlers &&
			                handlers.find(h => h.fn === callback && h.scope === scope), i = handlers.indexOf(h);
		            if (i === -1)
			                throw new Error('Invalid listener');
		            handlers.splice(i, 1);
		        }
	    $eachHandler(type, fn) {
		            if (this.__handlers && this.__handlers[type])
			                this.__handlers[type].forEach(handler => {
						                try {
									                    fn(handler);
									                }
						                catch (e) {
									                    if (type !== 'error')
										                        this.trigger('error', e);
									                    else
										                        throw e;
									                }
						            });
		        }
	    emit(type, ...args) {
		            this.$eachHandler(type, handler => handler.fn.call(handler.scope, ...args));
		        }
	    emitAndCollect(type, ...args) {
		            const result = [];
		            this.$eachHandler(type, handler => result.push(handler.fn.call(handler.scope, ...args)));
		            return result;
		        }
	    trigger(type, ...args) {
		            return this.emit(type, ...args);
		        }
	    once(type, callback, scope) {
		            const subscriber = this.on(type, (...args) => {
				                subscriber.unsubscribe();
				                return callback.call(scope, ...args);
				            });
		        }
}

function getMime(path)
{
	return mime.getType(path) || 'text/plain';
}

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
			this.$set(defaults);
	}

	$set(key, value)
	{
		if (typeof(key)==='object')
			Object.assign(this, key);
		else
			this[key] = value;
	}

	// TODO add checks in debug module
	set(key, value)
	{
		this.$set(key, value);
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
			ide.extend(this, obj);
		else if (required)
			throw `Could not read JSON file ${fn}`;

		return obj;
	}

}

class Setting {

	constructor(name, options)
	{
		this.name = name;
		this.exposed = options.exposed;
		this.help = options.help;
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
			mime: stat.isDirectory() ? 'text/directory' : getMime(file)
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
		return stat && stat.isDirectory ? 'text/directory' : getMime(file);
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

		const resolve = ide.plugins.emitAndCollect('file.beforewrite', this);

		return Promise.all(resolve)
			.then(() => cxl.file.write(this.path, this.content, { encoding: null }))
			.then(() => {
				ide.plugins.emit('file.write', this);
				return this.read();
			});
	}

}

class FileWalker {

	constructor(path, ignore, recursive)
	{
		this.root = path;
		this.ignore = ignore;
		this.recursive = recursive;
	}

	serialize(file, stat)
	{
		// TODO make file objects more consistent
		return {
			filename: file,
			mime: stat.isDirectory() ? 'text/directory' : getMime(file)
		};
	}

	$recursiveWalk(dir)
	{
		this.$pending++;

		fs.readdir(this.root + '/' + dir, (err, list) => {
			// Ignore Errors
			if (!err)
				list.forEach(file => {

					let relfile = path.join(dir, file);

					if (!(this.ignore && this.ignore(file)))
					{
						this.$pending++;
						fs.stat(this.root + '/' + relfile, (err, stat) => {
							if (!err)
							{
								if (this.recursive && stat.isDirectory())
									this.$recursiveWalk(relfile);

								this.$results.push(this.serialize(relfile, stat));
							} else
								console.log('Error ', relfile, err);

							if (--this.$pending===0) this.$resolve();
						});
					}
				});
			else
				console.log('Error ', dir, err);

			if (--this.$pending===0) this.$resolve();
		});

	}

	walk()
	{
		// TODO add reject condition
		return this.$promise || (this.$promise = new Promise(resolve => {
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
		this.$patterns = [];
		this.dirty = true;

		if (files)
			this.push(files);
	}

	push(files)
	{
		if (Array.isArray(files))
			files.forEach(this.push, this);
		else if (!this.$patterns.includes(files))
		{
			this.$patterns.push(files);
			this.dirty = true;
		}
	}

	build()
	{
		if (this.dirty)
		{
			this.matcher = path => micromatch.some(path, this.$patterns);

			this.source = '^' +
				this.$patterns.map(function(glob) {
				try {
					const regex = micromatch.makeRe(glob).source;
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

class FileManagerWatcher
{
	constructor(p)
	{
		this.$watchers = p.paths.map(dir => {
			try {
				return DirectoryWatch.create(dir).subscribe(ev => {
					const rel = path.relative(p.base, ev.path);

					if (!(p.ignore && p.ignore(rel)))
					{
						ev.relativePath = rel;
						p.onWatch(ev);
					}
				});
			} catch (e) {
				ide.module.dbg(e);
			}
		});
	}

	destroy()
	{
		this.$watchers.forEach(w => w.unsubscribe());
	}
}

class FileManager {

	constructor(path)
	{
		this.path = path;
		this.recursive = true;
	}

	build()
	{
	const
		walker = new FileWalker(this.path,
			this.$ignore.matcher, this.recursive)
	;
		this.building = true;
		return walker.walk().then(data => {
			this.building = false;
			this.files = data;
			this.watchFiles();

			return data;
		});
	}

	includes(path)
	{
		return !!this.files.find(f => f.filename===path);
	}

	watchFiles()
	{
		const files = this.files.reduce((a, f) => {
			if (f.mime==='text/directory')
				a.push(this.path + '/' + f.filename);
			return a;
		}, []);

		files.push(this.path);

		if (this.watcher)
			this.watcher.destroy();

		this.watcher = new FileManagerWatcher({
			base: this.path,
			ignore: this.$ignore.matcher,
			paths: files,
			onWatch: this.onEvent.bind(this)
		});

		this.log.dbg(`Watching ${files.length} directories. ${FileWatch.getCount()} Total`);
	}
}

class AssistServer {

	static CanAssistMime(mimeRegex)
	{
		return request => this.testMime(request, mimeRegex);
	}

	static testMime(request, mime)
	{
		return request.features.file && mime.test(request.features.file.mime);
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

class StreamResponse {

	constructor(response, stream)
	{
		this.response = response;
		this.subscription = stream.subscribe(this.onStream.bind(this));
	}

	onData(event)
	{
		var res = this.response;

		if (!res.headersSent)
			// TODO Use status Map
			res.writeHead(200);

		res.write(event.data);
	}

	onError(event)
	{
		var res = this.response;

		if (!res.headersSent)
			// TODO Use status Map
			res.writeHead(500);

		res.write(event.data);
	}

	onClose()
	{
		this.response.end();
		this.destroy();
	}

	onStream(event)
	{
		switch (event.type)
		{
		case 'data': return this.onData(event);
		case 'error': case 'errordata': return this.onError(event);
		case 'close': return this.onClose(event);
		default: throw "Unhandled Stream Event";
		}
	}

	destroy()
	{
		this.subscription.unsubscribe();
	}

}

class Theme
{
	constructor(p)
	{
		this.path = path.isAbsolute(p) ? p :
			ide.basePath + '/public/theme/' + p + '.css';
		this.source = null;
		this.observer = new FileWatch(this.path).subscribe(this.onWatch.bind(this));
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

		ide.plugins.on('assist', this.$onInlineAssist.bind(this));

		this.$plugin = pluginName;
		this.$mime = mimeMatch;
		this.$fileMatch = fileMatch;
	}

	onInlineAssist()
	{
	}

	canAssist(data)
	{
		var file = data.features.file;

		return file && (!this.$mime || this.$mime.test(file.mime)) &&
			(!this.$fileMatch || this.$fileMatch.test(file.path));
	}

	$onInlineAssist(request)
	{
		if (this.canAssist(request))
			this.onInlineAssist(request);
	}

}

class Stream extends cxl.rx.Subject {

}

class StreamEvent {

	constructor(type, data)
	{
		this.type = type;
		this.data = data;
	}

}

class ProcessStream extends Stream {

	$event(type, data)
	{
		this.next(new StreamEvent(type, data.toString()));
	}

	$onProcessClose(data)
	{
		this.$event('close', data);
	}

	$onProcessError(data)
	{
		this.$event('error', data);
	}

	$onData(data)
	{
		this.$event('data', data);
	}

	$onErrorData(data)
	{
		this.$event('errordata', data);
	}

	$initializeBindings(process)
	{
		process.on('exit', this.$onProcessClose.bind(this));
		process.on('error', this.$onProcessError.bind(this));
		this.$out.on('data', this.$onData.bind(this));
		this.$err.on('data', this.$onErrorData.bind(this));
	}

	constructor(process)
	{
		super();
		this.$in = process.stdin;
		this.$out = process.stdout;
		this.$err = process.stderr;
		this.$initializeBindings(process);
	}

	write(data)
	{
		this.$in.write(data.key);
	}

}

/**
 * A standalone process
 */
class Process {

	constructor(command, parameters, options)
	{
		if (command)
			this.spawn(command, parameters, options);
	}

	$spawn(command, parameters, options)
	{
		ide.module.dbg(`spawn: ${command} ${parameters.join(' ')}`);

		return cp.spawn(command, parameters, options);
	}

	$createStream(process)
	{
		return new ProcessStream(process);
	}

	get stream()
	{
		return this.$stream || (this.$stream = this.$createStream(this.$process));
	}

	spawn(command, parameters, options)
	{
		this.command = command;
		this.options = Object.assign({}, this.constructor.Defaults, options);

		var process = this.$process = this.$spawn(
			this.command, parameters, this.options
		);

		this.pid = process.pid;
	}

}

Process.defaults = {
	cwd: cwd,
	stdio: [ 'ignore' ]
};

class ThemeManager
{
	constructor()
	{
		this.themes = {
			default: { source: ' ' }
		};
	}

	/**
	 * Use this function to register a new Theme
	 */
	register(path, theme)
	{
		return (this.themes[path] = theme);
	}

	load(path)
	{
		var theme = this.themes[path] || this.register(path, new Theme(path));
		return theme.source!==null ? Promise.resolve(theme) : theme.load();
	}

}

class RPCServer {

	constructor(pluginName)
	{
		this.pluginName = pluginName;
		ide.plugins.on('socket.message.' + pluginName, this.$onSocket.bind(this));
	}

	notify(method, params, clients)
	{
		ide.socket.broadcast(this.pluginName, { method: method, params: params }, clients);
	}

	$respond(client, id, result)
	{
		ide.socket.respond(client, this.pluginName, { id: id, result: result });
	}

	$onError(client, data, err)
	{
		if (data.id)
			ide.socket.respond(client, this.pluginName, { id: data.id, error: {
				code: err.code, message: err.message, data: err.data
			}});
	}

	$isValidMethod(method)
	{
		return method.charAt(0)!=='$';
	}

	$onSocket(client, data)
	{
	var
		id = data.id,
		method = data.method,
		params = data.params,
		result
	;
		if (!this.$isValidMethod(method))
			return;

		try {
			result = this[method](params, client);
		} catch(e)
		{
			return this.$onError(client, data, e);
		}

		if (id)
			this.$respond(client, id, result);
	}

}

class ResourceManager {

	constructor()
	{
		this.resources = [];
	}

	add()
	{
		this.resources.push.apply(this.resources, arguments);
	}

	destroy()
	{
		this.resources.forEach(r => r.destroy ? r.destroy() : r.unsubscribe());
	}

}

module.exports = {

	AuthenticationAgent: AuthenticationAgent,
	AssistServer: AssistServer,
	Configuration: Configuration,
	Error: WorkspaceError,

	EventEmitter,
	File: File,
	FileWatch: FileWatch,
	DirectoryWatch: DirectoryWatch,

	FileMatcher: FileMatcher,
	FileManager: FileManager,
	FileWalker: FileWalker,

	LanguageServer: LanguageServer,
	LanguageServerStdIO: LanguageServerStdIO,
	Process: Process,
	ProcessStream: ProcessStream,
	RPCServer: RPCServer,
	ResourceManager: ResourceManager,
	ServerResponse: ServerResponse,
	Setting: Setting,
	Stream: Stream,
	Theme: Theme,

	// use require for win32
	basePath: require('path').resolve(__dirname + '/../'),
	cwd: cwd,
	themes: new ThemeManager(),

	http: {
		ServerResponse: ServerResponse,
		StreamResponse: StreamResponse
	},

	NPM: {

		/** Calls npm and returns a promise with the result */
		doNpm(cmd, args, cwd)
		{
			args = args || [ ];

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

		load()
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

		install(module)
		{
			return this.doNpm('install', [ [ module ] ]).then(a => a[0][1]);
		},

		uninstall(module)
		{
			return this.doNpm('uninstall', [ [ module ] ]);
		}

	},

	// TODO move to shared
	assist: {

		match(term, cursorValue, prefix)
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

		findObject(obj, cursorValue, fn)
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

		findArray(array, cursorValue, fn)
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
	 * Executes shell command using child_process.exec. Returns a Promise
	 *
	 * options:
	 *
	 * timeout  Default 5 seconds.
	 * cwd      Working Directory
	 * plugin   Plugin to use for logging
	 */
	exec(command, options)
	{
		return new Q(function(resolve, reject) {
			options = Object.assign({
				timeout: 5000,
				maxBuffer: 1024 * 500,
				plugin: ide.module
			}, options);

			options.plugin.dbg(`${options.cwd ? '[cwd:'+options.cwd+'] ' : '' }exec "${command}"`);

			cp.exec(command, options, function(err, stdout, stderr) {
				if (err && !options.ignoreError && err.code!==0)
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

	escapeHtml(str) {
		return (
			str && str.replace(ENTITIES_REGEX, e => ENTITIES_MAP[e])
		);
	},

	extend(obj, p)
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
				this.extend(c, val);
			else
				obj[i] = p[i];
		}

		return obj;
	}

};
