(function(ide) {
"use strict";
	
ide.Worker = function(fn, process)
{
var
	source = this.source = this.getSource(fn),
	worker = this.createWorker(source)
;
	this.assist = function(done, editor, token, meta)
	{
		var file = editor.file, msg = {
			$: ide.assist.version,
			file: file && file.id,
			mime: file && file.attributes.mime,
			meta: meta,
			token: {
				ch: token.ch, end: token.end,
				line: token.line, start: token.start,
				string: token.string, type: token.type
			}
		};
		
		worker.postMessage(process ? process(editor, token, msg) : msg);
	};
	
	worker.onmessage = function(e)
	{
		if (e.data.result)
			ide.assist.addHint(e.data.version, e.data.result);
	};
};
	
ide.Worker.prototype = {
	
	getSource: function(fn)
	{
		return this.source || 'var fn =' + fn.toString() +
			';onmessage=function(data) {' +
		'var r = fn(data.data); postMessage({ version: data.data.$, result: r });}';
	},
	
	createWorker: function(source)
	{
		var blob = new Blob([ source ], { type: 'text/javascript' });
		
		return new Worker(URL.createObjectURL(blob));
	}
	
};

})(this.ide);
