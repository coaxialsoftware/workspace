#!/usr/bin/env node

var node = 'node',
	bin = __dirname + '/../server/workspace.js',
	child_process = require('child_process'),
	child,
	startTime,
	timeout = 1000,
	args = process.argv.slice(2);
try {
	const config = require(process.cwd() + '/workspace.json');
	if (config.debug) args.push(`--inspect=${config['debug.port'] || '9222'}`);
} catch (e) {
	console.log(e);
}
/* jshint esnext:true */
args.push(bin);
start();

function onExit(code) {
	if (code !== 0 && Date.now() - startTime > timeout) {
		console.log(`Received signal ${code}. Attempting restart...`);
		start();
	}
}

function start() {
	startTime = Date.now();

	var c = child_process.spawn(node, args, {
		stdio: 'inherit',
	});

	c.on('exit', onExit);

	child = c;
}
