
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
			ide.workspace.remove(ide.editor, true);
	},

	q: function()
	{
		if (ide.editor)
			ide.workspace.remove(ide.editor);
	},

	help: function(topic)
	{
		window.open('/docs/index.html#' + (topic || ''));
	},

	tabe: function(name)
	{
		window.open('#' + ide.workspace.hash.encode({ f: name || false }));
	},

	project: function(name)
	{
		window.open('#' + ide.workspace.hash.encode({ p: name, f: null }));
	}

};

})(this.ide);
