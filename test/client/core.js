
QUnit.module('core', {
	afterEach: function() {
		$.mockjax.clear();
	}
});

QUnit.test('Initialized', function(a) {
	a.ok(ide.project);
});

QUnit.test('ide.warn', function(a) {
	var h = ide.warn('Hello World');
	a.equal(h.title, 'Hello World');
});

QUnit.test('ide.notify limit', function(a) {
	for (var i=0; i<105; i++)
		ide.notify(i+'');
	
	a.equal(ide.logger.items.length, 100);
});

QUnit.test('ide.notify ide.Item', function(a) {
	var item = new ide.Item();
	
	ide.notify(item);
	a.equal(ide.logger.items[0], item);
});

QUnit.test('ide.source', function(a) {
	var res = ide.source('return 10');
	a.equal(res, 10);
});

QUnit.test('ide.post', function(a) {
	var done = a.async();
	$.mockjax({ url: '/test', responseText: 'Hello World' });
	
	var xhr = ide.post('/test', { testing: true }, function(test) {
	}).then(done);
	a.ok(xhr);
});
	
QUnit.test('ide.post - 500', function(a) {
	var done = a.async();
	$.mockjax({ url: '/fail', status: 500 });
	
	var xhr2 = ide.post('/fail').fail(done);
	a.ok(xhr2);
});

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

QUnit.test('ide.openTab', function(a) {
	
	window.open = function(url) {
		a.ok(url);
	};
	
	ide.openTab('test').then(a.async());
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
	
});

QUnit.module('core - ide.Editor');

QUnit.test('ide.Editor', function(a) {
var
	e = new ide.Editor({ slot: ide.workspace.slot() })
;
	a.ok(e);
});

QUnit.test('ide.Editor#cmd', function(a) {
	var e = new ide.Editor({ slot: ide.workspace.slot() });
	
	a.equal(e.cmd('hello'), ide.Pass);
	
	e.commands = { hello: 'world', world: function(p) { return p; } };
	
	a.equal(e.cmd('hello', [1]), 1);
	a.equal(e.cmd('world', [2]), 2);
});
