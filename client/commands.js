
(function(ide) {
"use strict";

ide.commands = {

	info: function(msg)
	{
		ide.info.show(msg);
	},

	edit: function()
	{
		for (var i=0; i<arguments.length; i++)
			ide.open(arguments[i]);
	},

	e: 'edit',

	tabe: function(name)
	{
		window.open('#' + ide.hash.encode({ file: name }));
	},

	project: function(name)
	{
		window.open('#' + ide.hash.encode({ project: name, file: null }));
	}

};

})(this.ide);
