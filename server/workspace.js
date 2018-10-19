/**
 *
 * workspace Module
 *
 */
"use strict";

var
	compression = require('compression'),

	cxl = global.cxl = require('@cxl/cxl'),

	pkg = require(__dirname + '/../package.json'),
	ide = global.ide = require('./common'),

	// TODO @deprecate
	workspace = global.workspace = ide.module = module.exports = cxl('workspace')
;


class WorkspaceConfiguration extends ide.Configuration {

	constructor()
	{
		super({
			'editor.encoding': 'utf8',
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

			version: pkg.version,

			/**
			 * Default help URL. Defaults to /docs/index.html
			 */
			'help.url': 'docs/index.html',

			/**
			 * URL to get plugin information
			 */
			'plugins.url': 'https://cxl.firebaseio.com/workspace/plugins.json'
		});

		this.loadFile('~/.workspace.json');
		this.loadFile('workspace.json');

		// check for v8 inspector support
		const inspect = process.execArgv.join('').match(/--inspect(?:=(\d+))?/);

		if (inspect)
			this.set({ 'debug.inspect': +inspect[1] || 9222 });

		if (this.debug)
			cxl.enableDebug();
	}

	onUpdate()
	{
		ide.plugins.emit('workspace.reload');
	}

	loadFile(fn)
	{
		try {
			super.loadFile(fn);
		} catch(e) {
			workspace.dbg(e);
		}
	}

}

ide.restart = function()
{
	workspace.log('Restarting Workspace');
	setTimeout(function() {
		process.exit(128);
	}, 250);
};

workspace.createServer()

.use(compression())

.use(cxl.static(ide.basePath + '/public', { maxAge: 86400000 }))

.route('GET', '/plugins/source', function(req, res) {
	res.set('content-type', 'application/javascript');
	ide.ServerResponse.respond(res, ide.plugins.getSources(), this);
})

// Login Check
.use(function(req, res, next) {
	if (ide.authenticationAgent)
		ide.authenticationAgent.onRequest(req, res, next);
	else
		next();
})

// TODO verify limit
.use(cxl.bodyParser.json({ limit: Infinity, type: 'application/json' }))
.use(cxl.bodyParser.raw({ limit: Infinity, type: 'application/octet-stream'}))

.config(function()
{
	require('./plugins');

	ide.configuration = new WorkspaceConfiguration();
	this.port = ide.configuration.port;
	process.title = 'workspace:' + this.port;

	// Enable Test path
	if (ide.configuration.debug)
	{
		this.use(cxl.static(ide.basePath + '/test', { maxAge: 86400000 }));
		this.use(cxl.static(ide.basePath + '/node_modules/qunit/qunit', { maxAge: 86400000 }));
	}

	this.secure = ide.configuration.secure;
})
.run(function() {

	const config = ide.configuration;

	if (config.gid)
		process.setgid(config.gid);
	if (config.uid)
		process.setuid(config.uid);

	if (process.getuid)
		this.dbg(`Process running as ${process.getuid()}:${process.getgid()}`);

	ide.FileWatch.create('workspace.json').subscribe(ide.restart.bind(ide));

	this.dbg(`Serving Files from "${ide.basePath}/public" and "${ide.basePath}/test"`);

	require('./plugins').start();
	require('./socket').start();
	require('./project').start();
	require('./file').start();
	require('./assist').start();

	process.on('uncaughtException', this.error.bind(this));

	this.operation('Loading plugins', ide.plugins.start.bind(ide.plugins));
}).start();

