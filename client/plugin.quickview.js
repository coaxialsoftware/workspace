
(function(ide, j5ui) {

var
	Viewer = ide.Viewer = ide.Plugin.extend({

		quickview: null,
		mime: null,
		token_type: null,
		test: null,

		init: function()
		{
			this.quickview = ide.plugins._plugins.quickview;
			this.quickview.register(
				this.mime, this.token_type, this
			);
		}

	}),

	CSSViewer = Viewer.extend({

		mime: 'text/css',
		token_type: 'constant.numeric',

		test: function(token)
		{
			if (/#[a-fA-F0-9]+$/.test(token.value))
			{
				this.quickview.color(token.value);
				return true;
			}
		}

	})
;

ide.plugins.register('quickview', ide.Plugin.extend({

	viewers: {},

	on_token: function(editor, token)
	{
	var
		mime = editor.file.mime,
		viewers = this.viewers[mime],
		i
	;
		if (!token)
			return;

		if (viewers)
			viewers = viewers[token.type];

		if (viewers && viewers.length>0)
			for (i in viewers)
				if (viewers[i].test(token))
					return;
	},

	register: function(mime, type, plugin)
	{
	var
		m = this.viewers[mime] || (this.viewers[mime]={}),
		t = m[type] || (m[type] = [])
	;
		t.push(plugin);
	},

	start: function()
	{
		ide.on('tokenchange', this.on_token.bind(this));

		// Load default viewers
		new CSSViewer();
	},

	color: function(color)
	{
		j5ui.info('<div style="width: 100%; height: 32px; background-color: ' +
			color+ ';"></div>');
	}

}));

})(window.ide, window.j5ui);
