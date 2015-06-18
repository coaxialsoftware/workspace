/**
 * workspace.Shell
 */
"use strict";

var
	cxl = require('cxl'),

	workspace = require('./workspace'),
	plugin = module.exports = cxl('workspace.shell')
;

plugin.config(function() {

	this.server = workspace.server;

}).route('POST', '/shell', function(req, res) {
var
	me = this,
	query = req.body.q,
	command, process
;
	if (!req.body.c)
		return res.send(this.error('Invalid command.'));

	command = req.body.c + (query ? ' ' + query.join(' ') : '');

	me.log(command);

	process = require('child_process').spawn(
		req.body.c, req.body.q,
		{ cwd: req.body.p, detached: true, stdio: [ 'ignore' ] }
	);
	process.on('error', function(err) {
		me.error(err);
	});
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
	process.on('close', function(code) {
		res.end();
		me.log(command + ' returned with status ' + code);
	});
	process.unref();

});