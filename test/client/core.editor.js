
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
