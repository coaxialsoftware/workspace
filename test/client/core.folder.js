
QUnit.module('folder');

QUnit.test('open()', function(a) {

	var file = new ide.File(), done=a.async();

	file.mime = 'text/directory';
	file.content = [];

	ide.open(file).then(function(editor) {
		a.ok(editor instanceof ide.FileListEditor);
		a.equal(editor.children.length, 1);
		done();
	});

});