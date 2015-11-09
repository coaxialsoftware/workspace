
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
	
	open: function(options)
	{
		if (options.file==='login')
			return new LoginDialog(options);
	},
	
	commands: {
		login: function()
		{
			ide.workspace.add(new LoginDialog({
				plugin: this
			}));
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
	
	onAssist: function(done)
	{
		if (this.hint)
			done(this.hint);
	},
	
	onProject: function()
	{
		var user = ide.project.get('user');
		
		this.hint = user ? {
			code: 'online',
			title: ide.project.get('user'),
			icons: [ { title: 'user', class: 'user' } ]
		} : null;
	},
	
	ready: function()
	{
		ide.plugins.on('socket.message.online', this.onMessage, this);
		ide.plugins.on('assist', this.onAssist, this);
		ide.plugins.on('project.load', this.onProject, this);
		
		this.onProject();
	}

});
	
})(this.ide, this.cxl);