
ide.plugins.register('tern', ide.Plugin.extend({

	on_ready: function()
	{
	var
		defs = [],
		i
	;
		for (i in this.defs)
			defs.push(this.defs[i].json);

		this.server = new tern.Server({
			async: true,
			defs: defs
		});
	},

	start: function()
	{
	var
		l = this.loader = new Loader()
	;
		l.script("tern/node_modules/acorn/acorn.js");
		l.script("tern/node_modules/acorn/acorn_loose.js");
		l.script("tern/node_modules/acorn/util/walk.js");

		l.script('tern/lib/tern.js');
		l.script('tern/lib/def.js');
		l.script('tern/lib/jsdoc.js');
		l.script('tern/lib/infer.js');

		this.defs = {
			ecma5: l.json('tern/defs/ecma5.json')
		};

		l.ready(this.on_ready.bind(this));
	}

}));