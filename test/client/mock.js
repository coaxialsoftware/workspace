
(function() {

/*ide.socket.ws = {
	readyState: WebSocket.OPEN
};

ide.socket.send = function() { };*/
ide.Hash.prototype.save = function() { };
ide.Hash.prototype.set = function(obj) { cxl.extend(this.data, obj); };

var start = QUnit.start.bind(QUnit);

if (window.__karma__)
{
	// Prevent auto start of tests by karma
	QUnit.start = function() { };
}

var subscriber = ide.plugins.on('project.load', function() {
	start();
	subscriber.unsubscribe();
});

})();