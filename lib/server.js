
var
	express = require('express'),
	http = require('http'),

	project = require('./project.js').project,
	
	app = express(),
	server = http.createServer(app).listen(project.config.port),
	address = server.address(),

	rootdir = __dirname + '/..'
;

app.use(express.compress());

console.log('Serving public');
app.use(express.static(rootdir + '/public'));
console.log('Serving dependecies');
app.use(express.static(rootdir + '/node_modules'));

process.title = 'ide.js:' + address.port;
app.use(express.bodyParser());

app.get('/project', function(req, res)
{
var
	result = project.to_json()
;
	res.send(result);
});

app.get('/file', function(req, res)
{
var
	result = project.get_file(req.query.n)
;
	result.mime = express.mime.lookup(result.filename);
	result.success = true;
	res.send(result);
});

app.post('/file', function(req, res)
{
	if (req.body && req.body.content)
	{
		project.put_file(req.query.n, req.body.content);
	}

	res.send({ success: true });
});

console.log("Listening to port " + address.port);
