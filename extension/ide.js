

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
			server: result,
			error: chrome.runtime.lastError
		});
	}

	extend(API.debugger, {

		attach: function(data, respond)
		{
			chrome.debugger.attach(data, VERSION.debugger, respond);
		},

		targets: function(data, respond)
		{
			chrome.debugger.getTargets(respond);
		}

	});

chrome.runtime.onMessage.addListener(function(req, sender) {
var
	client = req.client,
	api = API[client.api],
	fn = api && api[client.cmd],
	response = respond.bind(req, sender)
;
	if (fn)
		fn(client.data, response);
	else
		response();
});
