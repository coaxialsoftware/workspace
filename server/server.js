
var
	express = require('express'),
	editor = require('./editor.js').editor,
	fs = require('fs'),

	protocol = require(editor.config.https ? 'https' : 'http'),
	app = express(),

	rootdir = __dirname + '/..',

	server, address
;


if (editor.config.https)
{
	try {
		editor.config.https.key = fs.readFileSync(editor.config.https.key);
		editor.config.https.cert = fs.readFileSync(editor.config.https.cert);
	} catch (e)
	{
		editor.error('ERROR ' + e.message);
	}
}

// Create Server
server = (editor.config.https ?
	protocol.createServer(editor.config.https, app) :
	protocol.createServer(app))
		.listen(editor.config.port)
;

address = server.address();

if (!address)
{
	editor.error('Error listenting to port ' + editor.config.port);
}

if (editor.config.password)
{
	editor.log("Basic Authentication Enabled for user: " + editor.config.user);
	app.use(express.basicAuth(editor.config.user, editor.config.password));
}

app.use(express.compress());

editor.log('Serving public');
app.use(express.static(rootdir + '/public'));
editor.log('Serving dependecies');
app.use(express.static(rootdir + '/bower_components'));


process.title = 'ide.js:' + address.port;
app.use(express.bodyParser());

app.get('/home', function(req, res)
{
	res.send(editor.to_json);
});

app.get('/project', function(req, res)
{
var
	name = req.query.n
;
	editor.load_project(name, function(project)
	{
		res.send(project.to_json());
	});
});

app.get('/file', function(req, res)
{
	editor.get_file(req.query.n, function(result)
	{
		res.send(result);
	});
});

app.post('/file', function(req, res)
{
	editor.put_file(req.query.n, req.query.t, req.body && req.body.content,
	function(result)
		{
			res.send(result);
		}
	);
});

editor.log("Listening to port " + address.port);
