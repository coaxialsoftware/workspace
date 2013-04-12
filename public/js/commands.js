

ide.commands = {

	info: function(msg)
	{
		ide.info.show(msg);
	},

	edit: function()
	{
		for (i=0; i<arguments.length; i++)
			ide.open(arguments[i]);
	},
	
	e: 'edit',

	tabe: function(name)
	{
		window.open('#' + ide.hash.encode({ file: name }));
	}

};
