#!/usr/bin/env node 

var
	express = require('express'),

	editor  = require('../lib/editor.js'),
	project = new editor.Project(process.cwd()),

	app = express(),
	server = app.listen(project.config.port),
	address = server.address()
;

app.use(express.compress());
app.use(express.static('public'));
app.use(express.bodyParser());

app.get('/project/*', function(req, res)
{
var
	result = project.to_json()
;
	result.content = project.get_file(req.params[0]).toString();
	res.send(result);
});

app.get('/file/*', function(req, res)
{
	res.set('Content-Type', 'text/plain');
	res.send(project.get_file(req.params[0]));
});

app.post('/file/*', function(req, res)
{
	res.send(req.body);
});

console.log("Listening to port " + address.port);
