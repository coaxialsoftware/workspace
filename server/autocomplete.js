/*

module.exports = function(app, editor)
{
var
	Q = require('bluebird'),
	Inference = require('j5g3.inference').Inference,
	mime = require('mime'),

	common = require('./common'),

	handlers = {}
;
	function Javascript() {
		this.data = {};
	}

	Javascript.prototype = {

		data: null,

		compile: function(project)
		{
		var
			promises = [],
			files = project.config.files,
			path = project.path,
			infer = new Inference()
		;
			files.forEach(function(file) {

				var fn = path + '/' + file;

				if (mime.lookup(fn).match(/javascript/))
					promises.push(
						common.read(fn)
							.then(function(src) {
								infer.compile(fn, src);
							})
							.catch(function(err) {
								project.error(err);
							})
					);
			});

			return Q.join.apply(Q, promises)
				.bind(this)
				.then(function() {
					return (this.data[path] = infer);
				}
			);
		},

		find_symbol: function(file, pos)
		{
			return { file: file, pos: pos };
		},

		query: function(project, file, pos)
		{
		var
			data = this.data[project.path]
		;
			if (data)
				return Q.resolve(this.find_symbol(file, pos, data));

			return this.compile(project)
				.then(this.find_symbol.bind(this, file, pos))
			;
		}

	};

	handlers['application/javascript'] = new Javascript();

	app.get('/autocomplete', function(req, res)
	{
	var
		q = req.query,
		handler = handlers[q.mime]
	;
		if (!handler)
			return res.end();

		editor.load_project(q.project).then(function(project) {

			project.log("[autocomplete] Compiling " + q.mime + " files.");

			if (project.config.files)
				handler.query(project, q.file, q.pos).then(function(result) {
					res.send(result);
				});
			else
				res.end();

		});
	});
};
*/