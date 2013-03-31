
var
	express = require('express'),

	editor  = require('./lib/editor.js'),
	project = new editor.Project(process.cwd()),

	app = express(),
	server = app.listen(project.config.port),
	address = server.address()
;

app.use(express.compress());
app.use(express.static('public'));
//app.use(express.bodyParser());
//
app.get('/project', function(req, res)
{
	res.send(project.to_json());
});

console.log("Listening to port " + address.port);
