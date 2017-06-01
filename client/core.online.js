
(function(ide, cxl) {
"use strict";

function saveToken(auth)
{
	document.cookie = 'workspace=' + auth.token;
	return auth;
}

ide.LoginComponent = cxl.component({
	name: 'ide-login',
	shadow: false,
	template: `<cxl-container>
<cxl-form &="submit:=loading:#submit =user:unless">
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
<div &="=error:if:text"></div>
<div>
		<cxl-submit &="=loading:set(submitting)">Log In</cxl-submit>
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

	loading: false,

	onAuth: function(auth)
	{
		this.user = auth && auth.username;
		this.$component.trigger('auth', auth);
		this.loading = false;
	},

	onError: function()
	{
		this.error = 'Invalid username or password';
		this.loading = false;
	},

	logOut: function()
	{
		ide.run('logout');
	},

	submit: function()
	{
		var data = {
			u: this.$component.get('username'),
			p: this.$component.get('password')
		};

		if (ide.socket.isConnected())
			ide.socket.send('online', { login: data });
		else
			return cxl.ajax.post('/login', data)
				.then(saveToken)
				.then(this.onAuth.bind(this), this.onError.bind(this));
	}

});


ide.plugins.register('online', new ide.Plugin({

	core: true,

	commands: {

		login: function()
		{
			return new ide.ComponentEditor({
				title: 'login',
				component: ide.LoginComponent
			});
		},

		logout: function()
		{
			ide.socket.send('online', { logout: true });
			// TODO
			document.cookie = 'workspace=;expires=Thu, 01 Jan 1970 00:00:01 GMT;';
		}
	},

	onMessage: function(data)
	{
		if ('auth' in data)
		{
			if (data.auth)
			{
				ide.notify('Logged in as ' + data.auth.username);
				saveToken(data.auth);
			} else
				ide.project.set('online.username', null);

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