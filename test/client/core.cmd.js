
QUnit.module('core.cmd');

QUnit.test('Should Parse Single Command With No Parameters', function(a) {
var
	cmd = ide.commandParser.parse('quit')
;
	a.ok(cmd.fn);
	a.ok(!cmd.args);
});