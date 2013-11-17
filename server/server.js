
var
	express = require('express'),

	editor = require('./editor.js').editor,

	protocol = require(editor.config.https ? 'https' : 'http'),

	app = express(),
	server = (editor.config.https ? 
		protocol.createServer(editor.config.https, app) :
		protocol.createServer(app))
			.listen(editor.config.port),

	address = server.address(),

	rootdir = __dirname + '/..'
;

if (editor.config.password)
{
	console.log("Basic Authentication Enabled for user: " + editor.config.user);
	app.use(express.basicAuth(editor.config.user, editor.config.password));
}

app.use(express.compress());

console.log('Serving public');
app.use(express.static(rootdir + '/public'));
console.log('Serving dependecies');
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
	name = req.query.n,
	project = editor.load_project(name)
;
	res.send(project.to_json());
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

console.log("Listening to port " + address.port);
