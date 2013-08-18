
(function(ide) {
"use strict";

ide.plugins.register('tern', ide.Plugin.extend({

	files: null,
	server: null,
	defs: null,

	shortcut: "ctrl-32",

	invoke: function()
	{
	var
		pos, file = ide.editor.file
	;
		if (this.server && file && file.mime==="application/javascript")
		{
			this.server.addFile(ide.editor.file.filename, ide.editor.get_value());

			pos = ide.editor.get_position();

			this.server.request({
				query: {
					type: 'completions',
					file: ide.editor.file.filename,
					end: { line: pos.row, ch: pos.column }
				}
			}, this.request_callback.bind(this));
		}
	},

	request_callback: function() //err, result)
	{
	},

	on_ready: function()
	{
	var
		defs = [],
		i
	;
		for (i in this.defs)
			defs.push(this.defs[i].json);

		this.server = new window.tern.Server({
			async: true,
			defs: defs
		});

		for (i in this.files)
			this.server.addFile(this.files[i].source, this.files[i].raw);
	},

	load_files: function(files)
	{
		for (var i in files)
			this.files[files[i]] = this.loader.data(files[i]);
	},

	start: function()
	{
	var
		config = this.config = ide.project['plugin.tern'] || {},
		l = this.loader = new window.Loader()
	;
		this.files = {};

		this.load_files(config.files);

		this.defs = {
			ecma5: l.json('tern/defs/ecma5.json')
		};

		l.ready(this.on_ready.bind(this));
	}

}));

})(window.ide);
