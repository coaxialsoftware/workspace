
QUnit.module('core.cmd');

QUnit.test('Should Parse Single Command With No Parameters', function(a) {
var
	cmd = ide.commandParser.parse('quit')
;
	a.ok(cmd.fn);
	a.ok(!cmd.args);
});

QUnit.test('Should Parse Single Command With Single Path', function(a) {
var
	cmd = ide.commandParser.parse('quit now')
;
	a.equal(cmd.fn, 'quit');
	a.equal(cmd.args[0], 'now');
});

QUnit.test('Should Parse Single Command With Multiple Paths', function(a) {
var
	cmd = ide.commandParser.parse('quit now test\\ space.js\t \tmultiple/hello')
;
	a.equal(cmd.fn, 'quit');
	a.equal(cmd.args[0], 'now');
	a.equal(cmd.args[1], 'test space.js');
	a.equal(cmd.args[2], 'multiple/hello');
});

QUnit.test('Should Parse Single Command With Multiple Strings', function(a) {
var
	cmd = ide.commandParser.parse('quit "single" "multiple word" "quote\\" middle"')
;
	a.equal(cmd.fn, 'quit');
	a.equal(cmd.args[0], 'single');
	a.equal(cmd.args[1], 'multiple word');
	a.equal(cmd.args[2], 'quote" middle');
});

QUnit.test('Should parse Regex parameters', function(a) {
var
	cmd = ide.commandParser.parse('hello.world /\\w+\\w/gi /\\d\\d/m')
;
	a.equal(cmd.fn, 'hello.world');
	a.equal(cmd.args[0].source, '\\w+\\w');
	a.equal(cmd.args[1].source, '\\d\\d');
});

QUnit.test('Should parse Javascript parameters', function(a) {
var
	cmd = ide.commandParser.parse('hello.world `10+10``"No Spaces"` `"hell\\`o"`')
;
	a.equal(cmd.fn, 'hello.world');
	a.equal(cmd.args[0], 20);
	a.equal(cmd.args[1], 'No Spaces');
	a.equal(cmd.args[2], 'hell`o');
});

QUnit.test('Should parse mixed parameters', function(a) {
var
	cmd = ide.commandParser.parse('hello.world "10+10""No Spaces"/abc/g `"hell\\`o"`')
;
	a.equal(cmd.fn, 'hello.world');
	a.equal(cmd.args[0], '10+10');
	a.equal(cmd.args[1], 'No Spaces');
	a.equal(cmd.args[2].source, 'abc');
	a.equal(cmd.args[3], 'hell`o');
});

QUnit.test('Should parse multiple commands with mixed parameters', function(a) {
var
	cmd = ide.commandParser.parse(
		'hello "10+10""No Spaces"/abc/g `"hell\\`o"`; ' +
		'world "10+10""No Spaces"/abc/g `"hell\\`o"`;'
	)
;
	a.equal(cmd[0].fn, 'hello');
	a.equal(cmd[0].args[0], '10+10');
	a.equal(cmd[0].args[1], 'No Spaces');
	a.equal(cmd[0].args[2].source, 'abc');
	a.equal(cmd[0].args[3], 'hell`o');
	
	a.equal(cmd[1].fn, 'world');
	a.equal(cmd[1].args[0], '10+10');
	a.equal(cmd[1].args[1], 'No Spaces');
	a.equal(cmd[1].args[2].source, 'abc');
	a.equal(cmd[1].args[3], 'hell`o');
});
