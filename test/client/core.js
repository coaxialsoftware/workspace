
QUnit.module('core');

QUnit.test('Initialized', function(a) {
	a.ok(ide.project);
});

QUnit.test('ide.warn', function(a) {
	var h = ide.warn('Hello World');
	a.equal(h.title, 'Hello World');
});

QUnit.test('ide.notify limit', function(a) {
	ide.logger.delay = 0;

	for (var i=0; i<105; i++)
		ide.notify(i+'');
	var done = a.async();

	setTimeout(function() {
		a.equal(ide.logger.items.length, 100);
		done();
	});
});

QUnit.test('ide.notify ide.Item', function(a) {
	ide.logger.delay = 0;
	var item = new ide.Notification({});

	ide.notify(item);
	var done = a.async();

	setTimeout(function() {
		a.equal(ide.logger.items[0], item);
		done();
	});
});

QUnit.test('ide.source', function(a) {
	var res = ide.source('return 10');
	a.equal(res, 10);
});

QUnit.test('ide.openTab', function(a) {

	window.open = function(url) {
		a.ok(url);
	};

	ide.openTab('test').then(a.async());
});

QUnit.test('Item', function(a) {

	var item = new ide.Item({});

	a.equal(item.priority, 0);

	item.render();

	a.ok(item.el);

	item = new ide.Item({
		priority: 10,
		className: 'error',
		title: 'Hello',
		value: 'World',
		action: 'test',
		code: 'Code'
	});

	a.equal(item.priority, 10);
	a.equal(item.title, 'Hello');
	a.equal(item.value, 'World');
	a.equal(item.action, 'test');
	a.equal(item.key, ':test');
	a.equal(item.code, 'code');

	item = new ide.Item({
		title: 'Hello'
	});

	a.equal(item.title, 'Hello');
	a.equal(item.value, 'Hello');

});

QUnit.test('Notification', function(a) {

	var item = new ide.Notification("Hello World", 'error');

	a.equal(item.title, 'Hello World');
	a.equal(item.className, 'error');

});

/*
QUnit.test('ide.open - string', function(a) {

	var done = a.async();

	$.mockjax({ url: '/file*', responseText: {
		filename: 'test',
		content: 'Hello',
		mime: ''
	} });

	ide.open('test').then(function(editor) {
		a.ok(editor);
		done();
	});

});
QUnit.test('ide.open - plugin', function(a) {

	var done = a.async();

	$.mockjax({ url: '/file*', responseText: {
		filename: 'test',
		content: 'Hello',
		mime: ''
	} });

	ide.plugins.register('test', {
		edit: function(o) {
			a.equal(o.file.get('filename'), 'test');
			done();
		}
	});

	ide.plugins.register('test2', {
		open: function(o) {
			a.equal(o.file, 'test');
		}
	});

	ide.open({ file: 'test', plugin: 'test2' });
	ide.open({ file: 'test', plugin: 'test' });

});*/

QUnit.module('ide.Editor');

QUnit.test('ide.Editor', function(a) {
var
	e = new ide.Editor({
		plugin: { name: 'test' },
		title: 'test'
	})
;
	a.equal(e.header.title, 'test');
});

QUnit.test('ide.Editor#blur', function(a) {
var
	A = new ide.Editor({
		plugin: { name: 'test' }
	}),
	B = new ide.Editor({
		plugin: { name: 'test' }
	})
;
	A.focus.set();
	a.equal(ide.editor, A);
	B.focus.set();
	a.equal(ide.editor, B);
});


QUnit.test('ide.Editor#quit', function(a) {
var
	e = new ide.Editor({
		plugin: { name: 'test' }
	})
;
	ide.workspace.slot().setEditor(e);
	a.equal(ide.workspace.slots.length, 1);
	ide.workspace.remove(e);
	a.equal(ide.workspace.slots.length, 0);
});

QUnit.module('ide.FileEditor');

QUnit.test('ide.FileEditor', function(a) {
var
	file = new ide.File(),
	e = new ide.FileEditor({
		plugin: { name: 'test' },
		file: file
	})
;
	a.equal(e.file, file);
});

/*QUnit.test('ide.Editor#cmd', function(a) {
	var e = new ide.Editor({
		plugin: { name: 'test' },
		slot: ide.workspace.slot()
	});

	a.equal(e.cmd('hello'), ide.Pass);

	e.commands = { hello: 'world', world: function(p) { return p; } };

	a.equal(e.cmd('hello', [1]), 1);
	a.equal(e.cmd('world', [2]), 2);
});*/
