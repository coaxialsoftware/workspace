

var
	VERSION = {
		debugger: '1.1'
	},

	API = {
		debugger: function() { }
	}
;

	function extend(A, B)
	{
		for (var i in B)
			A[i] = B[i];
	}

	function respond(sender, result)
	{
		chrome.tabs.sendMessage(sender.tab.id, {
			id: this.id,
			server: result
		});
	}

	extend(API.debugger, {

		attach: function(respond)
		{
			chrome.debugger.attach(cmd.attach, VERSION.debugger, respond);
		},

		targets: function(respond)
		{
			chrome.debugger.getTargets(respond);
		}

	});

chrome.runtime.onMessage.addListener(function(data, sender) {
var
	client = data.client,
	api = API[client.api],
	fn = api && api[client.cmd],
	response = respond.bind(data, sender)
;
	if (fn)
		fn(response);
	else
		response();
});
