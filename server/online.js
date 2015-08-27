/**
 *
 * workspace.online
 * 
 */

var
	cxl = require('cxl'),
	Firebase = require('firebase'),
	
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
			this.log('Disconnected');
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
				token: this.token
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
	url = workspace.configuration['online.url'] || 'https://cxl.firebaseio.com',
	data = workspace.data('online')
;
	this.dbg(`Connecting to ${url}`);
	
	this.fb = new Firebase(url);
	this.fb.onAuth(this.onAuth.bind(this));
	
	if (data && data.token)
	{
		this.loginToken(data.token);
		this.username = data.username;
		this.gravatar = data.gravatar;
	}
	
	workspace.plugins.on('socket.message.online', this.onMessage.bind(this));
});
