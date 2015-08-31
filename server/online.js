/**
 *
 * workspace.online
 * 
 */

var
	cxl = require('cxl'),
	
	workspace = require('./workspace'),
	online = module.exports = cxl('workspace.online')
;

online.extend({
	
	uid: null,
	token: null,
	gravatar: null,
	username: null,

	onAuth: function(auth)
	{
		var response;
		
		if (!auth)
		{
			response = { auth: null };
			workspace.data('online', null);
			this.log('Not Authenticated');
		} else
		{
			this.uid = auth.uid;
			this.token = auth.token;
			
			if (auth.password)
			{
				this.username = auth.password.email;
				this.gravatar = auth.password && auth.password.profileImageURL;
			}

			this.log(`Logged In as ${this.username}!`);
			
			workspace.configuration.user = this.username;
			workspace.configuration.gravatar = this.gravatar;
			
			workspace.data('online', {
				username: this.username,
				gravatar: this.gravatar,
				token: this.token,
				url: this.fb.toString()
			});
			
			response = { auth: { uid: this.uid, gravatar: this.gravatar } };
		}

		workspace.socket.broadcast('online', response);
	},
	
	onComplete: function(client, err)
	{
		if (err)
		{
			if (client)
				workspace.socket.respond(client, 'online', {
					login: false
				});
			return this.error('Authentication failed.');
		}
	},
	
	login: function(client, data)
	{
		this.log(`Logging in as ${data.u}`);
		
		this.fb.authWithPassword({
			email: data.u,
			password: data.p
		}, this.onComplete.bind(this, client));
	},
	
	loginToken: function(token)
	{
		this.fb.authWithCustomToken(token, this.onComplete.bind(this, null));
	},
	
	onMessage: function(client, msg)
	{
		if (msg.login)
			this.login(client, msg.login);
	}
	
})
.run(function() {
var
	fb = this.fb = workspace.fb,
	url = fb.toString(),
	data = workspace.data('online')
;
	fb.onAuth(this.onAuth.bind(this));
	
	if (data)
	{
		if (data.url !== url)
			delete data.token;

		if (data.token)
		{
			this.loginToken(data.token);
			this.username = data.username;
			this.gravatar = data.gravatar;
		}
	}
	
	workspace.plugins.on('socket.message.online', this.onMessage.bind(this));
});
