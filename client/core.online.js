
(function(ide, cxl) {
"use strict";

var LoginComponent = cxl.component({
	name: 'ide-login',
	shadow: false,
	template: `<cxl-container>
<cxl-form &="submit:#submit =user:unless">
	<h1>Log In</h1>
<cxl-form-group>
	<cxl-label>Username</cxl-label>
	<cxl-input inverse &="valid(required) value:=username" /></cxl-input>
</cxl-form-group>
<cxl-form-group>
	<cxl-label for="password">Password</cxl-label>
	<cxl-password inverse &="valid(required) value:=password"></cxl-password>
</cxl-form-group>
<br>
<div>
		<cxl-submit>Log In</cxl-submit>
</div>
</cxl-form>
<div &="=user:if">
<p>Logged In as <span &="=user:text"></span></p>
<br>
<cxl-button primary &="click:#logOut">Log Out</cxl-button>
</div>
</cxl-container>`,
	bindings: [ 'ide.on(online.auth):#onAuth'],
	initialize: function(state)
	{
		state.user = ide.project.get('online.username');
	}
}, {

	onAuth: function(auth)
	{
		this.user = auth && (auth.username || auth.uid);
	},

	logOut: function()
	{
		ide.socket.send('online', { logout: true });
	},

	submit: function()
	{
		ide.socket.send('online', {
			login: {
				u: this.$component.get('username'),
				p: this.$component.get('password')
			}
		});
	}

});


ide.plugins.register('online', new ide.Plugin({

	core: true,

	commands: {
		login: function()
		{
			return new ide.ComponentEditor({
				component: LoginComponent
			});
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
		var user = ide.project.get('online.username');

		this.hint = user ? new ide.Item({
			code: 'online',
			title: user
		}) : null;
	},

	ready: function()
	{
		this.listenTo('socket.message.online', this.onMessage);
		this.listenTo('assist', this.onAssist);
		this.listenTo('project.load', this.onProject);

		this.onProject();
	}

}));

})(this.ide, this.cxl);