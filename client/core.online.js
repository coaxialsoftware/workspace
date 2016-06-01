
(function(ide, cxl) {
"use strict";

var LoginDialog = ide.Editor.extend({

	templateUrl: 'tpl-login',

	file: 'login',

	onAuth: function(auth)
	{
		this.username = auth && (auth.username || auth.uid);
		this.digest();
	},

	initialize: function()
	{
		this.template = cxl.id(this.templateUrl).innerHTML;
		this.listenTo(ide.plugins, 'online.auth', this.onAuth);
		this.username = ide.project.get('user.name');
	},

	logOut: function()
	{
		ide.socket.send('online', { logout: true });
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
				ide.notify('Logged in as ' + data.auth.username);

			ide.plugins.trigger('online.auth', data.auth);
		} else if (data.login===false)
			ide.error('Could not log in.');
	},

	onAssist: function(done)
	{
		if (this.hint)
			done(this.hint);
	},

	onProject: function()
	{
		var user = ide.project.get('online.user');

		this.hint = user ? {
			code: 'online',
			title: user,
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