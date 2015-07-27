
var
	fs = require('fs'),
	_ = require('lodash'),
	path = require('path')
;

function Watcher(options)
{
	_.extend(this, options);
	
	if (typeof(this.paths)==='string')
		this.paths = [ path ];
	
	this.watchers = {};
	this.events = {};
	
	if (this.base)
		this.initWatcher('.');
	
	this.paths.forEach(this.initWatcher.bind(this));
}

_.extend(Watcher.prototype, {
	
	/** @required */
	paths: null,
	delay: 100,
	ignore: null,
	watchers: null,
	events: null,
	base: null,
	
	onEvent: null,
	
	trigger: function(id, ev, file, full)
	{
		delete this.events[id];
		
		if (this.onEvent)
			this.onEvent(ev, file, full);
	},
	
	onWatch: function(dir, ev, filename)
	{
		if (!filename)
			return;
		
	var
		full = path.join(dir, filename),
		rel = this.base ? path.relative(this.base, full) : full,
		id = ev + ' ' + rel,
		timeout = this.events[id]
	;
		if (this.ignore && this.ignore(rel))
			return;
		if (timeout)
			clearTimeout(timeout);
		
		this.events[id] = setTimeout(
			this.trigger.bind(this, id, ev, rel, full), this.delay);
	},
	
	onError: function()
	{
		console.log(arguments);
	},
	
	close: function()
	{
		_.invoke(this.watchers, 'close');
		this.watchers = {};
	},
	
	initWatcher: function(p)
	{
	var
		id = this.base ? path.join(this.base, p) : p,
		w
	;
		if (this.watchers[id])
			throw `${p} already watched.`;
		
		w = fs.watch(id);
		w.on('change', this.onWatch.bind(this, id));
		w.on('error', this.onError.bind(this, id));
		
		this.watchers[id] = w;
	}
	
});


module.exports = Watcher;