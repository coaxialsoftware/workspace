
QUnit.module('ide.commandParser');

QUnit.test('Should Parse Single Command With No Parameters', function(a) {
var
	cmd = ide.commandParser.parse('quit')[0]
;
	a.ok(cmd.fn);
	a.ok(!cmd.args);
});

QUnit.test('Should Parse Single Command With Single Path', function(a) {
var
	cmd = ide.commandParser.parse('quit now')[0]
;
	a.equal(cmd.fn, 'quit');
	a.equal(cmd.args[0], 'now');
});

QUnit.test('Should Parse Single Command With Multiple Paths', function(a) {
var
	cmd = ide.commandParser.parse('quit now test\\ space.js\t \tmultiple/hello')[0]
;
	a.equal(cmd.fn, 'quit');
	a.equal(cmd.args[0], 'now');
	a.equal(cmd.args[1], 'test space.js');
	a.equal(cmd.args[2], 'multiple/hello');
});

QUnit.test('Should Parse Single Command With Multiple Strings', function(a) {
var
	cmd = ide.commandParser.parse('quit "single" "multiple word" "quote\\" middle"')[0]
;
	a.equal(cmd.fn, 'quit');
	a.equal(cmd.args[0], 'single');
	a.equal(cmd.args[1], 'multiple word');
	a.equal(cmd.args[2], 'quote" middle');
});

QUnit.test('Should parse Regex parameters', function(a) {
var
	cmd = ide.commandParser.parse('hello.world /\\w+\\w/gi /\\d\\d/m')[0]
;
	a.equal(cmd.fn, 'hello.world');
	a.equal(cmd.args[0].source, '\\w+\\w');
	a.equal(cmd.args[1].source, '\\d\\d');
});

QUnit.test('Should parse Javascript parameters', function(a) {
var
	cmd = ide.commandParser.parse('hello.world `10+10``"No Spaces"` `"hell\\`o"`')[0]
;
	a.equal(cmd.fn, 'hello.world');
	a.equal(cmd.args[0], 20);
	a.equal(cmd.args[1], 'No Spaces');
	a.equal(cmd.args[2], 'hell`o');
});

QUnit.test('Should parse mixed parameters', function(a) {
var
	cmd = ide.commandParser.parse('hello.world "10+10""No Spaces"/abc/g `"hell\\`o"`')[0]
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

QUnit.test('commandParser.run()', function(a) {
	
	var done = a.async();

	ide.registerCommand('test', function(n, s) {
		a.equal(n, 10);
		a.equal(s, 'hello');
	});
	
	ide.commandParser.run('test 10 "hello"');
	
	ide.registerCommand('test', {
		fn: function(s, n) {
			a.equal(n, 10);
			a.equal(s, 'hello');
			done();
		}
	});
	
	ide.commandParser.run('test "hello" 10');
});

QUnit.module('ide.Command');

QUnit.test('ide.Command#constructor', function(a) {
var
	done = a.async(),
	scope = { test: 'test' },
	A = new ide.Command('test', function(num) {
		a.equal(num, 10);
	}),
	B = new ide.Command('test2', function(test) {
		a.equal(this.test, test);
		done();
	}, scope)
;
	a.ok(A instanceof ide.Command);
	A.apply(null, [ 10 ]);
	B.apply(null, [ 'test' ]);
});
