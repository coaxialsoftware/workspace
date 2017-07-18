/**
 *
 * workspace Module
 *
 */
"use strict";

var
	compression = require('compression'),
	path = require('path'),
	_ = require('lodash'),
	Q = require('bluebird'),
	cp = require('child_process'),

	cxl = require('@cxl/cxl'),

	common = require('./common.js'),
	Watcher = require('./watcher.js'),

	basePath = path.resolve(__dirname + '/../'),
	workspace = global.workspace = module.exports = cxl('workspace'),

	ServerResponse = require('./http').ServerResponse
;

/**
 * Options
 *
 * onUpdate   Callback function.
 */
class Configuration {

	constructor(defaults)
	{
		var me = this;

		me.$ = 0;
		me.update = _.debounce(function() {
			me.$++;
			if (me.onUpdate)
				me.onUpdate();
			return me;
		}, 500);

		if (defaults)
			me.set(defaults);
	}

	// TODO add checks in debug module
	set(key, value)
	{
		if (typeof(key)==='object')
			cxl.extend(this, key);
		else
			this[key] = value;

		return this.update();
	}

	/**
	 * Will extend configuration, it will not override array or objects.
	 */
	extend(obj)
	{
		common.extend(this, obj);
		return this.update();
	}

	/**
	 * Loads a JSON configuration file. Uses extend method to set properties.
	 */
	loadFile(fn)
	{
		var obj = common.load_json_sync(fn);

		if (obj)
			this.extend(obj);
		else
			workspace.dbg(`Could not read JSON file ${fn}`);

		return obj;
	}
}

var
	WORKSPACE_JSON_ASSIST = {},
	PROJECT_JSON_ASSIST = {}
;

class WorkspaceConfiguration extends Configuration {

	constructor()
	{
		super({
			'editor.encoding': 'utf8'
		});

		this.loadFile('~/.workspace.json');
		this.loadFile('workspace.json');

		if (this['plugins.global']===undefined && !this['plugins.path'])
			this['plugins.global'] = true;

		// check for v8 inspector support
		var inspect = process.execArgv.join('').match(/--inspect(?:=(\d+))?/);

		this.set({
			inspect: inspect && (+inspect[1] || 9222)
		});

		if (this.debug)
			cxl.enableDebug();
	}

	/**
	 * Used for workspace.json assist
	 */
	registerSettings(config)
	{
		if (Array.isArray(config))
			return config.forEach(this.registerSettings.bind(this));

		WORKSPACE_JSON_ASSIST[config.name] = config;
	}

	/**
	 * Used for project.json assist
	 */
	registerProjectSettings(config)
	{
		if (Array.isArray(config))
			return config.forEach(this.registerSettings.bind(this));

		PROJECT_JSON_ASSIST[config.name] = config;
	}

	onUpdate()
	{
		workspace.plugins.emit('workspace.reload');
	}

}

cxl.define(WorkspaceConfiguration, {

	/**
	 * Enable Debug Mode.
	 */
	debug: false,

	/**
	 * Port to start the server
	 */
	port: 9001,

	/**
	 * Whether or not to use encryption. HTTPS and WSS
	 *
	 * Object containing key and cert filenames.
	 *
	 * @type {object}
	 */
	secure: null,

	/**
	 * User scripts. Will be added to all projects.
	 */
	scripts: null,

	/**
	 * Default help URL. Defaults to /docs/index.html
	 */
	'help.url': null,

	/**
	 * Operating System Path separator
	 */
	'path.separator': path.sep,

	/**
	 * URL to get plugin information
	 */
	'plugins.url': 'https://cxl.firebaseio.com/workspace/plugins.json'

});

class AuthenticationAgent {

	isAuthenticated() { throw "Not Implemented"; }
	onRequest(/*req, res, next*/) { throw "Not Implemented"; }

}

workspace.extend({

	AuthenticationAgent: AuthenticationAgent,
	Configuration: Configuration,

	configuration: new WorkspaceConfiguration(),

	basePath: basePath,
	cwd: path.resolve(process.cwd()),
	common: common,

	_: _,
	Q: Q,
	micromatch: require('micromatch'),

	restart: function()
	{
		this.log('Restarting Workspace');
		setTimeout(function() {
			process.exit(128);
		});
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
			options = _.extend({
				timeout: 5000,
				plugin: workspace
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

	shell: function(command, params, cwd, res)
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
	},

	__watches: {},

	watch: function(path, cb)
	{
	var
		id = this.watcher.watchFile(path),
		watches = this.__watches[id] || (this.__watches[id]=[])
	;
		this.dbg(`Watching File "${id}"`);

		if (cb)
		{
			watches.push(cb);
			this.plugins.on('workspace.watch:' + id, cb);
		}

		return id;
	},

	unwatch: function(id, cb)
	{
		this.dbg(`Unwatching File "${id}"`);
		this.watcher.unwatch(id);
		_.pull(this.__watches, cb);
		this.plugins.removeListener('workspace.watch:' + id, cb);
	},

	onWatch: function(ev, file)
	{
		if (file==='workspace.json')
		{
			return this.restart();
		}

		workspace.plugins.emit('workspace.watch:' + file, ev, file);
	},

	reload: function()
	{
		workspace.plugins.emit('workspace.reload');
	},

	registerAuthenticationAgent(Agent)
	{
		this.authenticationAgent = new Agent();
	}

})

.createServer()

.use(compression())

.use(cxl.static(basePath + '/public', { maxAge: 86400000 }))

.route('GET', '/plugins/source', function(req, res) {
	res.set('content-type', 'application/javascript');
	ServerResponse.respond(res, workspace.plugins.getSources(), this);
})

// Login Check
.use(function(req, res, next) {
	if (this.authenticationAgent)
		this.authenticationAgent.onRequest(req, res, next);
	else
		next();
})

// TODO verify limit
.use(cxl.bodyParser.json({ limit: Infinity, type: 'application/json' }))
.use(cxl.bodyParser.raw({ limit: Infinity, type: 'application/octet-stream'}))

.config(function()
{
	require('./theme.js');
	require('./plugins.js');

	this.plugins = new workspace.PluginManager();
	this.port = this.configuration.port;
	this.watcher = new Watcher({
		onEvent: this.onWatch.bind(this)
	});

	common.stat('workspace.json')
		.then(this.watcher.watchFile.bind(this.watcher, 'workspace.json'),
			this.log.bind(this, 'No workspace.json found.'));

	process.title = 'workspace:' + this.port;

	// Enable Test path
	if (this.configuration.debug)
		this.use(cxl.static(basePath + '/test', { maxAge: 86400000 }));

	this.secure = this.configuration.secure;
})
.run(function() {
	this.dbg(`Serving Files from "${basePath}/public" and "${basePath}/test"`);

	require('./socket').start();
	require('./project').start();
	require('./file').start();
	require('./assist').start();

	process.on('uncaughtException', this.error.bind(this));

	this.operation('Loading plugins', this.plugins.start.bind(this.plugins));
}).start();

