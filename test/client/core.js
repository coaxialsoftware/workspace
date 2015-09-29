
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
	
