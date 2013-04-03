#!/usr/bin/env node 

var
	express = require('express'),

	editor  = require('../lib/editor.js'),
	project = new editor.Project(process.cwd()),

	app = express(),
	server = app.listen(project.config.port),
	address = server.address(),

	rootdir = __dirname + '/..'
;

app.use(express.compress());

console.log('Serving public');
app.use(express.static(rootdir + '/public'));
console.log('Serving dependecies');
app.use(express.static(rootdir + '/node_modules'));

app.use(express.bodyParser());

app.get('/project', function(req, res)
{
var
	result = project.to_json()
;
	res.send(result);
});

app.get('/file/*', function(req, res)
{
var
	result = project.get_file(req.params[0])
;
	res.set('Content-Type', 'application/json');
	res.send(result);
});

app.post('/file/*', function(req, res)
{
	if (req.body && req.body.content)
	{
		project.put_file(req.params[0], req.body.content);
	}

	res.send({ success: true });
});

console.log("Listening to port " + address.port);
