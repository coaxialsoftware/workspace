#!/usr/bin/env node

var
	node = 'node',
	bin = __dirname + '/../server/workspace.js',
	child_process = require('child_process'),
	child = start(),
	startTime, timeout=1000
;
/* jshint esnext:true */

function onExit(code)
{
	if (code !== 0 && startTime-Date.now() > timeout)
	{
		console.log(`Received signal ${code}. Attempting restart...`);
		child = start();
	}
}

function start()
{
	startTime = Date.now();

	var c = child_process.spawn(node, [bin], {
		stdio: 'inherit'
	});

	c.on('exit', onExit);

	return c;
}

