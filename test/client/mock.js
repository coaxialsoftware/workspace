
(function() {
	
/*ide.socket.ws = {
	readyState: WebSocket.OPEN
};

ide.socket.send = function() { };*/
ide.Hash.prototype.save = function() { };

var subscriber = ide.plugins.on('project.load', function() {
	QUnit.start();
	subscriber.unsubscribe();
});
	
})();