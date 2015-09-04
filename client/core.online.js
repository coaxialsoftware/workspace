
(function(ide, cxl) {
"use strict";
	
var LoginDialog = ide.Editor.extend({
	
	templateUrl: 'tpl-login',
	
	file: 'login',
	
	onAuth: function(auth)
	{
		this.auth = auth;
	},
	
	_setup: function()
	{
		this.template = cxl.id(this.templateUrl).innerHTML;
		this.listenTo(ide.plugins, 'online.auth', this.onAuth);
	},
	
	submit: function()
	{
		ide.socket.send('online', {
			login: {
				u: this.$el.find('[name="username"]').val(),
				p: this.$el.find('[name="password"]').val()
			}
		});
	}
});
	
ide.plugins.register('online', {
	
	login: function()
	{
		var editor = new LoginDialog({
			plugin: this
		});

		ide.workspace.add(editor);
	},
	
	open: function(file)
	{
		if (file==='login')
			this.login();
	},
	
	commands: {
		login: function()
		{
			this.login();
		}
	},
	
	onMessage: function(data)
	{
		if ('auth' in data)
		{
			if (data.auth)
				ide.notify('Logged in as ' + data.auth.uid);
			
			ide.plugins.trigger('online.auth', data.auth);
		}
	},
	
	ready: function()
	{
		ide.plugins.on('socket.message.online', this.onMessage, this);
	}

});
	
})(this.ide, this.cxl);