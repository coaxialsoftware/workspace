
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
		this.watchPath('.');
	
	if (this.paths)
		this.paths.forEach(this.watchPath.bind(this));
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
	
	getId: function(p)
	{
		return this.base ? path.join(this.base, p) : p;
	},
	
	watchFile: function(f)
	{
	var
		id = this.getId(f),
		dir = path.dirname(id)
	;
		return this._doWatch(id, dir);
	},
	
	unwatch: function(id)
	{
		if (this.watchers[id])
		{
			this.watchers[id].close();	
			delete this.watchers[id];
		}
	},
	
	_doWatch: function(id, dir)
	{
		if (this.watchers[id])
			throw `${id} already watched.`;
		
		try {
			var w = fs.watch(id);
			w.on('change', this.onWatch.bind(this, dir));
			w.on('error', this.onError.bind(this, dir));
			
			this.watchers[id] = w;
			
			return id;
		} catch(e) {
			workspace.error(e);
		}
	},
	
	watchPath: function(p)
	{
		var id = this.getId(p);
		
		return this._doWatch(id, id);
	}
	
});


module.exports = Watcher;
