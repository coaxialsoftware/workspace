
QUnit.module('Commands');

QUnit.test('assist', function(a) {

	ide.run('assist');
	a.ok(ide.assist.panel.visible);
	ide.run('assist');
	a.ok(!ide.assist.panel.visible);

});