
var
	jshint = require('jshint').JSHINT,
	path = require('path'),
	fs = require('fs'),
	
	cxl = require('cxl'),
	workspace = require('./workspace'),
	socket = require('./socket'),
	
	plugin = module.exports = cxl('workspace.jshint')
;

plugin.extend({
	
	findOptions: function(p, f)
	{
		var file = path.dirname(f) + '/.jshintrc', data;
		
		if (!fs.existsSync(file))
		{
			file = p + '/.jshintrc';
			if (!fs.existsSync(file))
				file = false;
		}
		
		if (file)
		{
			this.dbg(`Using ${file} as config.`);
			
			try { data = JSON.parse(fs.readFileSync(file, 'utf8')); }
			catch(e) {
				this.dbg('Coult not read jshintrc file.');
			}
			finally {
				return data;
			}
		}
	},
	
	/**
	 * data: { $:id, p:project, f:path, js:code }
	 */
	onMessage: function(client, data)
	{
		this.operation(`Linting file ${data.f}`, function() {
			var options = this.findOptions(data.p, data.f);
			jshint(data.js, options, options && options.globals);
		});
		
		var payload = jshint.data();
		
		payload.$ = data.$;
		payload.v = data.v;
		
		socket.respond(client, 'jshint', payload);
		
		if (payload.errors)
			payload.errors.forEach(function(e) {
				if (e)
					this.error(`${e.line}:${e.character} ${e.reason}`);
			}, this);
	}
	
}).run(function() {
	
	workspace.plugins.on('socket.message.jshint', this.onMessage.bind(this));
	
});
