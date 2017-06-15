
QUnit.module('core');

QUnit.test('Initialized', function(a) {
	a.ok(ide.project);
});

QUnit.test('ide.warn()', function(a) {
	var h = ide.warn('Hello World');
	a.equal(h.title, 'Hello World');
});

QUnit.test('ide.notify() - limit', function(a) {
	ide.logger.delay = 0;

	for (var i=0; i<105; i++)
		ide.notify(i+'');
	var done = a.async();

	setTimeout(function() {
		a.equal(ide.logger.items.length, 100);
		done();
	});
});

QUnit.test('ide.notify() - ide.Item', function(a) {
	ide.logger.delay = 0;
	var item = new ide.Notification({});

	ide.notify(item);
	var done = a.async();

	setTimeout(function() {
		a.equal(ide.logger.items[0], item);
		done();
	});
});

QUnit.test('ide.source()', function(a) {
	var res = ide.source('return 10');
	a.equal(res, 10);
});

QUnit.test('ide.openTab()', function(a) {

	window.open = function(url) {
		a.ok(url);
	};

	ide.openTab('test').then(a.async());
});

QUnit.test('ide.open() - plugin', function(a) {
var
	done = a.async(),
	file1 = new ide.File(),
	file2 = new ide.File()
;
	file1.mime = 'application/x-test';
	file2.mime = 'application/x-test2';

	ide.plugins.register('test', {
		open: function(o) {
			return o.file.mime==='application/x-test' && new ide.Editor({ command: 'test' });
		}
	});

	ide.plugins.register('test2', {
		open: function(o) {
			return o.file.mime==='application/x-test2' && new ide.Editor({ command: 'test2' });
		}
	});

	cxl.Promise.all([
		ide.open({ file: file1 }),
		ide.open({ file: file2 })
	]).then(function(r) {
		a.ok(r[0].command==='test');
		a.ok(r[1].command==='test2');
		ide.workspace.remove(r[0]);
		ide.workspace.remove(r[1]);
		done();
	});
});

QUnit.module('ide.resources');

QUnit.test('ide.resources.getIcon()', function(a) {
var
	icon = ide.resources.getIcon('tag')
;
	a.ok(icon);
	a.throws(function() {
		ide.resources.getIcon('tagtag');
	});
});

