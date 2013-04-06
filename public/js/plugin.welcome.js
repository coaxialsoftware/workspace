
ide.plugin('welcome', {
	
	setup: function()
	{
		j5ui.alert('Welcome ' + ide.project.env.USER);
	}
});