#!/usr/bin/env node 

var
	express = require('express'),

	editor  = require('../lib/editor.js'),
	project = new editor.Project(process.cwd()),

	app = express(),
	server = app.listen(project.config.port),
	address = server.address(),

	static_dir = __dirname + '/../public'
;

app.use(express.compress());

console.log('Serving static content from ' + static_dir);
app.use(express.static(static_dir));

app.use(express.bodyParser());

app.get('/project/*', function(req, res)
{
var
	result = project.to_json()
;
	if (req.params[0])
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
	if (req.body && req.body.content)
	{
		project.put_file(req.params[0], req.body.content);
	}

	res.send({ success: true });
});

console.log("Listening to port " + address.port);
