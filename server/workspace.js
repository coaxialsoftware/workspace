/**
 *
 * workspace Module
 *
 */
"use strict";

var
	compression = require('compression'),
	path = require('path'),

	cxl = require('@cxl/cxl'),

	ide = global.ide = require('./common'),
	// TODO @deprecate
	workspace = global.workspace = module.exports = cxl('workspace')
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

			/**
			 * Default help URL. Defaults to /docs/index.html
			 */
			'help.url': 'docs/index.html',

			/**
			 * Operating System Path separator
			 */
			'path.separator': path.sep,

			/**
			 * URL to get plugin information
			 */
			'plugins.url': 'https://cxl.firebaseio.com/workspace/plugins.json'
		});

		this.loadFile('~/.workspace.json');
		this.loadFile('workspace.json');

		if (this['plugins.global']===undefined && !this['plugins.path'])
			this['plugins.global'] = true;

		// check for v8 inspector support
		var inspect = process.execArgv.join('').match(/--inspect(?:=(\d+))?/);

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

	/*checkForUpdates: function()
	{
		workspace.NPM.doNpm('view', [['@cxl/workspace', 'version']]).then(version => {
			console.log(Object.keys(version)[0]);
		}, (e) => console.log(e));
	},

	update: function()
	{

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
			ide.plugins.on('workspace.watch:' + id, cb);
		}

		return id;
	},

	unwatch: function(id, cb)
	{
		workspace.dbg(`Unwatching File "${id}"`);
		this.fileWatcher.unwatch(id);
		_.pull(this.__watches, cb);
		this.plugins.removeListener('workspace.watch:' + id, cb);
	}
	*/

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
	ide.fileWatcher = new ide.FileWatcher({
		onEvent: function(ev) {
			var file = ev.filename;

			if (file==='workspace.json')
				return ide.restart();

			ide.plugins.emit('workspace.watch:' + file, ev);
		}
	});

	this.port = ide.configuration.port;

	cxl.file.stat('workspace.json')
		.then(ide.fileWatcher.watchFile.bind(ide.fileWatcher, 'workspace.json'),
			this.log.bind(this, 'No workspace.json found.'));

	process.title = 'workspace:' + this.port;

	// Enable Test path
	if (ide.configuration.debug)
		this.use(cxl.static(ide.basePath + '/test', { maxAge: 86400000 }));

	this.secure = ide.configuration.secure;
})
.run(function() {
	this.dbg(`Serving Files from "${ide.basePath}/public" and "${ide.basePath}/test"`);

	require('./plugins').start();
	require('./socket').start();
	require('./project').start();
	require('./file').start();
	require('./assist').start();

	process.on('uncaughtException', this.error.bind(this));

	this.operation('Loading plugins', ide.plugins.start.bind(ide.plugins));
}).start();

