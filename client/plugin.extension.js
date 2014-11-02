
(function(ide, $) {
"use strict";

ide.plugins.register('extension', {

	id: 0,
	promises: {},

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
		promise = new $.Deferred(),
		id
	;
		if (this.enabled)
		{
			id = this.id++;
			this.promises[id] = promise;
			window.postMessage({ id: id, client: json }, '*');

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
			ide.alert('Browser extension not installed. Some features will' +
			'not be available');

		window.addEventListener('message', this.on_message.bind(this));
	}

});

})(this.ide, this.jQuery);