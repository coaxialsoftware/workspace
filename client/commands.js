
(function(ide) {
"use strict";

ide.commands = {

	info: function(msg)
	{
		ide.info.show(msg);
	},

	edit: function()
	{
		if (arguments.length)
			for (var i=0; i<arguments.length; i++)
				ide.open(arguments[i]);
		else
			ide.open();
	},

	e: 'edit',

	q: function()
	{
		if (ide.editor)
			ide.editor.close();
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
