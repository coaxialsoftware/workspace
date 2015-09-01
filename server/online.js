/**
 *
 * workspace.online
 * 
 */

var
	cxl = require('cxl'),
	Firebase = require('firebase'),
	
	common = require('./common'),
	workspace = require('./workspace'),
	online = module.exports = cxl('workspace.online')
;

online.extend({
	
	uid: null,
	token: null,
	gravatar: null,
	username: null,
	__connected: null,

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
	},
	
	isConnected: function()
	{
		return common.promiseProp(this, '__connected', 1000);
	},
	
	setupFirebase: function()
	{
	var
		url = this.url = workspace.configuration['online.url'] ||
			'https://cxl.firebaseio.com/workspace'
	;
		this.fb = new Firebase(url);
		this.__info = new Firebase(this.fb.root() + '/.info');
	},
	
	__getRef: function(p)
	{
		return new Firebase(this.url + p);
	},
	
	getRest: function()
	{
	},
	
	get: function(p)
	{
		var fb = this.__getRef(p);
		
		return common.promiseCallback(fb.once.bind(fb, 'value'))
			.bind(this).then(
				function(data) { return data.val(); },
				function() { this.error(`Could not read "${p}"`); }
			);
	},
	
	watch: function(p, cb, scope)
	{
		var fb = this.__getRef(p);
		
		this.dbg(`Watching ${p}`);
		fb.on('value', function(data) {
			cb.call(scope, data.val());
		});
	},
	
	onProject: function(project)
	{
		project.configuration['online.url'] = this.url;
	}
	
})
.config(function() {
	this.setupFirebase();	
	workspace.online = this;
})
.run(function() {
var
	fb = this.fb,
	url = this.url,
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
	
	this.__info.child('connected').on('value', function(snap) {
		var status = this.__connected = snap.val();
		this.log(status ? 'Connected' : 'Disconnected');
	}, this);
	
	workspace.plugins.on('project.load', this.onProject.bind(this));
	workspace.plugins.on('socket.message.online', this.onMessage.bind(this));
});
