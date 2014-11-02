
(function(ide, $) {
"use strict";

ide.plugins.register('extension', {

	id: 0,
	promises: {},

	// How long to wait for extension before rejecting promise.
	timeout: 5000,

	on_message: function(ev)
	{
	var
		id = ev.data.id,
		msg = ev.data.server
	;
		if (msg)
		{
			if (this.promises[id])
			{
				this.promises[id].resolve(msg);
				delete this.promises[id];
			} else
				ide.error("Invalid Message received");
		}
	},

	/** Send json message to extension if available */
	send: function(json)
	{
	var
		promises = this.promises,
		promise = new $.Deferred(),
		id
	;
		if (this.enabled)
		{
			id = this.id++;
			promises[id] = promise;
			window.postMessage({ id: id, client: json }, '*');
			window.setTimeout(function() {
				if (promise.state()!=='resolved')
				{
					delete promises[id];
					promise.reject("Timeout");
				}
			}, this.timeout);

			return promise;
		} else
			return promise.reject("Extension not enabled");
	},

	start: function()
	{
		this.enabled = document.body.classList.contains('ide-extension');

		if (this.enabled)
			ide.log('Browser extension enabled.');
		else
			ide.alert('Browser extension not installed. Some features will ' +
			'not be available.');

		window.addEventListener('message', this.on_message.bind(this));
	}

});

})(this.ide, this.jQuery);