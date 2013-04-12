
ide.plugins.register('welcome', ide.Plugin.extend({
	
	start: function()
	{
		j5ui.alert('Welcome ' + ide.project.env.USER);
	}

}));
