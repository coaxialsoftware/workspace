(function(ide, cxl) {
"use strict";

ide.Worker = function(methods)
{
var
	source = this.buildSource(methods),
	worker = this.worker = this.createWorker(source)
;
	this.$ = 0;
	this.response = [];
	this.methods = methods;

	worker.onmessage = this.onMessage.bind(this);
};

ide.Worker.prototype = {

	response: null,

	destroy: function()
	{
		this.worker.terminate();
	},

	onMessage: function(e)
	{
	var
		data = e.data,
		id = data.$,
		cb = this.response[id]
	;
		delete this.response[id];

		if (cb)
		{
			if (data.error)
				(cb.error || ide.error)(data.error);
			else if (data.result !== undefined)
				cb(data.result);
		}
	},

	post: function(method, data, cb)
	{
	var
		id = this.$++,
		msg = { $: id, method: method, data: data }
	;
		this.response[id] = cb;
		this.worker.postMessage(msg);
	},

	promise: function(method, data)
	{
		var me = this;

		return new Promise(function(resolve, reject) {
			resolve.error = reject;
			me.post(method, data, resolve);
		});
	},

	getSource: function(fn, name)
	{
		return 'self["' + name + '"]=' + fn.toString() + ';';
	},

	buildSource: function(methods)
	{
		var result = '', i;

		for (i in methods)
			result += this.getSource(methods[i], i);

		result += 'onmessage=function(ev) { try { var data=ev.data;' +
		'data.result=self[data.method](data.data);}catch(e){data.error=e.message;}' +
		'postMessage(data);}';

		return result;
	},

	createWorker: function(source)
	{
		var blob = new Blob([ source ], { type: 'text/javascript' });

		return new Worker(URL.createObjectURL(blob));
	}

};

ide.WorkerManager = function()
{
	this.workers = [];
	ide.plugins.on('assist', this.onAssist.bind(this));
};

ide.WorkerManager.prototype = {

	register: function(worker)
	{
		this.workers.push(worker);
	},

	unregister: function(worker)
	{
		cxl.pull(this.workers, worker);
	},

	onAssist: function(done, editor, token)
	{
	var
		file = editor && editor.file, msg = {
			$: ide.assist.version,
			type: 'assist',
			file: file && file.id,
			mime: file && file.attributes && file.attributes.mime,
			token: token && token.toJSON()
		},
		l = this.workers.length, a
	;
		while (l--)
		{
			a = this.workers[l];

			if (a.methods.canAssist && !a.methods.canAssist(msg))
				return;
			if (a.methods.assist)
				a.post('assist', msg, done);
		}
	}

};

ide.workerManager = new ide.WorkerManager();

})(this.ide, this.cxl);
