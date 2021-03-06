/**
 *
 * workspace.online
 *
 * workspace.json Configuration
 *
 * online.url	   Firebase repository url
 * online.useREST  Use firebase REST API for get(). Used to bypass firewall rules.
 *
 */

var
	Firebase = require('firebase'),

	common = require('./common'),
	workspace = require('./workspace'),
	online = module.exports = cxl('workspace.online')
;

class OnlineWatcher {

	constructor(path, fn)
	{
		var fb = this.ref = online.__getRef(path);

		this.path = path;
		this.fn = function(data) {
			fn(data.val());
		};

		fb.on('value', this.fn);
	}

	unsubscribe()
	{
		this.ref.off('value', this.fn);
	}

}

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

			this.uid = this.token = this.username = this.gravatar = null;

			this.dbg('Not Authenticated');
		} else
		{
			this.uid = auth.uid;
			this.token = auth.token;

			if (auth.password)
			{
				this.username = auth.password.email;
			} else if (auth.auth && auth.auth.token)
			{
				this.username = auth.auth.token.email;
			}

			this.log(`Logged In as ${this.username}!`);

			// TODO get username
			response = { auth: this.getAuthResponse(auth) };
		}

		workspace.configuration.set({
			'online.username': this.username
		});

		workspace.socket.broadcast('online', response);
		workspace.plugins.emit('online.auth', auth);
	},

	getAuthResponse: function(auth)
	{
		// TODO verify username
		return {
			uid: auth.uid,
			username: auth.password ? auth.password.email : auth.auth.token.email,
			token: auth.token
		};
	},

	onComplete: function(client, err)
	{
		if (err)
		{
			if (client)
				workspace.socket.respond(client, 'online', {
					login: false
				});
			this.dbg(err);
			return this.error('Authentication failed.');
		}
	},

	login: function(client, data)
	{
		this.log(`Logging in as ${data.u}`);

		return this.fb.authWithPassword({
			email: data.u,
			password: data.p
		}, this.onComplete.bind(this, client)).then(this.getAuthResponse);
	},

	logout: function()
	{
		this.log('Logging out');
		this.fb.unauth();
	},

	loginToken: function(token)
	{
		this.dbg('Logging in with token ' + token);
		return this.fb.authWithCustomToken(token, this.onComplete.bind(this, null));
	},

	onMessage: function(client, msg)
	{
		if (msg.login)
			this.login(client, msg.login);
		else if (msg.logout)
			this.logout(client);
	},

	onConnect: function(client)
	{
		workspace.socket.respond(client, 'online', {
			auth: this.uid ? {
				uid: this.uid, gravatar: this.gravatar,
				username: this.username, token: this.token
			} : null
		});
	},

	isConnected: function()
	{
		return common.promiseProp(this, '__connected', 1000);
	},

	setupFirebase: function()
	{
	var
		url = this.url = workspace.configuration['online.url']
	;
		this.dbg(`Connecting to ${url}`);
		this.fb = new Firebase(url);
		this.__info = new Firebase(this.fb.root() + '/.info');
	},

	__getRef: function(p)
	{
		return this.fb.child(p);
	},

	getRest: function(p)
	{
	var
		base = workspace.configuration['online.url'],
		url = `${base}/${p}.json`
	;
		this.dbg(`Retrieving ${url}`);

		return cxl.request(url).then(function(res) {
			return JSON.parse(res.body);
		});
	},

	get: function(p)
	{
		if (workspace.configuration['online.useREST'])
			return this.getRest(p);

		var fb = this.__getRef(p),
			cb = fb.once.bind(fb, 'value')
		;

		this.dbg(`Retrieving ${fb}`);

		return common.promiseCallback(cb)
			.bind(this).then(
				function(data) { return data.val(); },
				function() {
					this.error(`Could not read "${fb.path}"`);
				}
			);
	},

	watch: function(p, cb, scope)
	{
		this.dbg(`Watching ${p}`);
		return new OnlineWatcher(p, cb.bind(scope));
	}

})
.config(function() {
	this.setupFirebase();
	workspace.online = this;
})
.run(function() {
var
	fb = this.fb
	//url = this.url
	//data = workspace.data('online')
;
	fb.onAuth(this.onAuth.bind(this));

	/*if (data)
	{
		if (data.url !== url)
			delete data.token;

		if (data.token)
		{
			this.loginToken(data.token);
			this.username = data.username;
			this.gravatar = data.gravatar;
		}
	}*/

	this.__info.child('connected').on('value', function(snap) {
		var status = this.__connected = snap.val();
		this.dbg(status ? 'Connected' : 'Disconnected');
	}, this);

	workspace.plugins.on('socket.connect', this.onConnect.bind(this));
	workspace.plugins.on('socket.message.online', this.onMessage.bind(this));
});
