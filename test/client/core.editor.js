/*jshint esnext:true*/

QUnit.module('ide.feature');

QUnit.test('ide.EditorHeader', function(a) {
var
	editor = {},
	header = new ide.feature.EditorHeader(editor)
;
	a.ok(editor.header);
	header.title = 'Testing Header';
	a.equal(header.title, 'Testing Header');
	
	header.setTag('test', 'TEST');
	a.ok(header.tags.test);
	a.equal(header.tags.test.el.innerHTML, 'TEST');
});

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

QUnit.test('ide.Editor#cmd', function(a) {

	class TestEditor extends ide.Editor {}

	var e = new TestEditor({ });

	a.equal(e.cmd('hello'), ide.Pass);

	TestEditor.registerCommands({
		hello: 'world',
		world: function(p) { return p; }
	});

	a.equal(e.cmd('hello', [1]), 1);
	a.equal(e.cmd('world', [2]), 2);

});