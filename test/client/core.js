
QUnit.module('core', {
	afterEach: function() {
		$.mockjax.clear();
	}
});

QUnit.test('Initialized', function(a) {
	a.ok(ide.project);
});