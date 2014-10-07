
(function(ide) {
"use strict";

ide.plugins.register('quickview', new ide.Plugin({

	viewers: {
		'text/css': {
			'constant.numeric': function(token)
			{
				if (/#[a-fA-F0-9]+$/.test(token.value))
				{
					this.color(token.value);
					return true;
				}
			}
		}
	},

	register: function(mime, token, handler)
	{
		var v = this.viewers[mime] || (this.viewers[mime] = {});

		if (!v[token])
			v[token] = handler;
		else if (!(v[token] instanceof Array))
			v[token] = [ v[token], handler ];
		else
			v[token].push(handler);
	},

	color: function(color)
	{
		ide.notify('<div style="width: 100%; height: 32px; background-color: ' +
			color+ ';"></div>');
	},

	on_token: function(editor, token)
	{
	var
		mime = editor.file.get('mime'),
		viewers = this.viewers[mime],
		i
	;
		if (!token || !viewers)
			return;

		if (viewers)
			viewers = viewers[token.type];

		if (viewers instanceof Array)
		{
			for (i in viewers)
				if (viewers[i].call(this, token))
					return;
		} else if (viewers)
			viewers.call(this, token);
	},

	start: function()
	{
		ide.on('tokenchange', this.on_token.bind(this));
	}

}));

})(this.ide);
