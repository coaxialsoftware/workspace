
ide.socket.ws = {
	readyState: WebSocket.OPEN
};

ide.socket.send = function() { };
ide.Hash.prototype.save = function() { };

ide.plugins.on('project.load', function() {
	QUnit.start();
});