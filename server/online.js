/**
 *
 * workspace.online
 * 
 */

var
	cxl = require('cxl'),
	Firebase = require('firebase'),
	_ = require('lodash'),
	
	workspace = require('./workspace'),
	online = module.exports = cxl('workspace.online')
;

online.extend({
	
	login: function(data)
	{
		this.fb.authWithPassword({
			email: data.u,
			password: data.p
		});
	},
	
	onMessage: function(msg)
	{
		if (msg.login)
			this.login(msg.login);
	}
	
})
.run(function() {
var
	url = _.get(workspace.configuration, 'firebase.url', 'https://cxl.firebaseio.com')
;
	this.dbg(`Connecting to ${url}`);
	
	this.fb = new Firebase(url);
	workspace.plugins.on('socket.message.online', this.onMessage.bind(this));
});
