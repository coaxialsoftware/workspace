
window.addEventListener('message', function(ev)
{
	if (ev.source===window && ev.data.client)
		chrome.runtime.sendMessage(ev.data);
}, false);

chrome.runtime.onMessage.addListener(function(response) {

	window.postMessage(response, "*");

});

if (document.body)
	document.body.classList.add('ide-extension');
