

QUnit.module('project');

QUnit.test('Can get all projects', function(a) {

	cxl.ajax.get('/projects').then(p => {
		a.ok(p);
	}).then(a.async());

});