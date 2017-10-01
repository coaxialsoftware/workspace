
(function() {

/*ide.socket.ws = {
	readyState: WebSocket.OPEN
};

ide.socket.send = function() { };*/
ide.Hash.prototype.save = function() { };
ide.Hash.prototype.set = function(obj) { cxl.extend(this.data, obj); };

var subscriber = ide.plugins.on('project.load', function() {
	QUnit.start();
	subscriber.unsubscribe();
});

})();