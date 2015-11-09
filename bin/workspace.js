#!/usr/bin/env node

var
	node = 'node',
	bin = __dirname + '/../server/run.js',
	child_process = require('child_process'),
	child = start(),
	startTime, timeout=1000
;

function onExit(code)
{
	if (code !== 0 && startTime-Date.now() > timeout)
		child = start(); 
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

