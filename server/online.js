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
		if (!auth)
			return this.log('Disconnected');
		
		this.log('Connected!');
		
		this.uid = auth.uid;
		this.token = auth.token;
		this.username = auth.password.email;
		this.gravatar = auth.password && auth.password.profileImageURL;
		
		workspace.socket.broadcast('online', {
			auth: { uid: this.uid, gravatar: this.gravatar }
		});
	},
	
	onComplete: function(client, err)
	{
		if (err)
		{
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
	
	onMessage: function(client, msg)
	{
		if (msg.login)
			this.login(client, msg.login);
	}
	
})
.run(function() {
var
	url = workspace.configuration['online.url']
;
	this.dbg(`Connecting to ${url}`);
	
	this.fb = new Firebase(url);
	this.fb.onAuth(this.onAuth.bind(this));
	
	workspace.plugins.on('socket.message.online', this.onMessage.bind(this));
});
