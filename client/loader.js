/**
 * @license Copyright 2010-2012, Giancarlo F Bellido.
 */
(function(window, j5ui, undefined) {

/**
 * @class
 */
window.Loader = j5ui.Class.extend(/** @scope Loader.prototype */{

	EVENT: {
		IMG: 'load',
		AUDIO: 'canplaythrough',
		SCRIPT: 'load'
	},

	sources: null,
	delay: 250,
	progress: 0,
	start: null,
	length: 0,

	/** Called everytime progress changes */
	on_progress: null,
	/** Fires when one asset is loaded. */
	on_source: null,
	/**Fires when all assets are loaded. */
	on_ready: null,

	init: function ideLoader(p)
	{
		j5ui.Class.apply(this, [ p ]);

		this.sources = {};
		this.start = new Date();
	},

	_check_ready: function()
	{
	var
		i, ready=0, length=0, me=this
	;
		for (i in this.sources)
		{
			length++;
			if (this.sources.hasOwnProperty(i) && this.sources[i].ready)
				ready++;
		}

		this.progress = ready ? (ready/length) : 0;

		if (this.on_progress)
			this.on_progress(this.progress);

		if (length===ready)
		{
			if (this.on_ready) this.on_ready();
		}
		else
			this._timeout = window.setTimeout(function() { me._check_ready(); }, this.delay);
	},

	el: function(tag, src)
	{
	var
		me = this,
		result = this.sources[src], source
	;
		if (!result)
		{
			result = j5ui.dom(tag);
			this.sources[src] = source = { el: result };

			result.addEventListener(this.EVENT[tag], function() {
				source.ready = true;
				if (me.on_source)
					me.on_source(source);
			}, false);

			result.addEventListener('error', function() {
				source.ready = true;
				window.console.warn('Could not load asset: ' + src);
			}, false);

			result.setAttribute('src', src);

			this.length++;
		} else
			result = result.el;

		return result;
	},

	data: function(src, parse)
	{
	var
		me = this,
		xhr = new window.XMLHttpRequest(),
		result = this.sources[src]
	;
		if (!result)
		{
			result = this.sources[src] = {
				source: src
			};

			xhr.onreadystatechange = function() {
				if (xhr.readyState===4)
				{
					result.ready = true;
					result.raw = xhr.responseText;

					if (parse)
						parse(result);

					if (me.on_source)
						me.on_source(xhr);
				}
			};

			xhr.open('GET', src);
			xhr.send();
		}

		return result;
	},

	json: function(src)
	{
		return this.data(src, function(result) {
			result.json = JSON.parse(result.raw);
		});
	},

	script: function(src)
	{
	var
		result = this.el('SCRIPT', src)
	;
		window.document.head.appendChild(result);
		return result;
	},

	ready: function(callback)
	{
		if (callback)
			this.on_ready = callback;

		this._check_ready();
	},

	destroy: function()
	{
		window.clearTimeout(this._timeout);
	}

});

})(this, this.j5ui);
