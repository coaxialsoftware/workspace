
(function(ide) {
"use strict";

ide.commands = {

	edit: function()
	{
		if (arguments.length)
			for (var i=0; i<arguments.length; i++)
				ide.open(arguments[i]);
		else
			ide.open();
	},

	e: 'edit',

	"q!": function()
	{
		if (ide.editor)
			ide.editor.close(true);
	},

	q: function()
	{
		if (ide.editor)
			ide.editor.close();
	},

	help: function(topic)
	{
		window.open('/docs/index.html#' + topic);
	},

	tabe: function(name)
	{
		window.open('#' + ide.hash.encode({ file: name || false }));
	},

	project: function(name)
	{
		window.open('#' + ide.hash.encode({ project: name, file: null }));
	}

};

})(this.ide);
