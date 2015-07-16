
QUnit.module('core.file', {
	afterEach: function() {
		$.mockjax.clear();
	}
});

QUnit.test('Handle opening file fatal error.', function(a) {
	$.mockjax({ url: '/file?*', status: 500 });
	
	var f = new ide.File();
	f.fetch({ error: a.async() });
	a.ok(f);
});

QUnit.test('Handle saving file fatal error.', function(a) {
	$.mockjax({ url: '/file?*', status: 500 });
	
	var f = new ide.File();
	f.on('error', a.async());
	f.save();
	a.ok(f);
});