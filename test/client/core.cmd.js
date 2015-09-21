
QUnit.module('core.cmd');

QUnit.test('Should Parse Single Command With No Parameters', function(a) {
var
	cmd = ide.commandParser.parse('quit')
;
	a.ok(cmd.fn);
	a.ok(!cmd.args);
});

QUnit.test('Should Parse Single Command With Single Parameter', function(a) {
var
	cmd = ide.commandParser.parse('quit now')
;
	a.equal(cmd.fn, 'quit');
	a.equal(cmd.args[0], 'now');
});