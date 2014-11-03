
chrome.runtime.onMessage.addListener(function(data, sender) {

var
	response = {
		id: data.id
	},
	cmd = data.client.debugger
;

	function respond(result)
	{
		response.server = result;
		chrome.tabs.sendMessage(sender.tab.id, response);
	}

	if (cmd)
	{
		if (cmd.attach)
			chrome.debugger.attach(cmd.attach, '1.1', respond);

		if (cmd.targets)
			chrome.debugger.getTargets(respond);
	}

});
