
QUnit.module('core.diff', {
	afterEach: function() {
		$.mockjax.clear();
	}
});

QUnit.test('diff - append string beginning', function(a) {
	var A = "Hello World", B = "World";
	var diff = ide.diff(A, B);
	var atom = diff[0];
	
	a.equal(atom[0], -1);
	a.equal(atom[1], "Hello ");
	a.equal(atom[2], 0);
	
	var C = ide.patch(A, diff);
	a.equal(C, B);
});

QUnit.test('diff - remove string end', function(a) {
	var A = "Hello World", B = "Hello";
	var diff = ide.diff(A, B);
	var atom = diff[0];
	
	a.equal(atom[0], -1);
	a.equal(atom[1], " World");
	a.equal(atom[2], 5);
	
	var C = ide.patch(A, diff);
	a.equal(C, B);
});

QUnit.test('diff - remove string mid', function(a) {
	var A = "Hello World", B = "Hell orld";
	var diff = ide.diff(A, B);
	
	var C = ide.patch(A, diff);
	a.equal(C, B);
});

QUnit.test('diff - multiple changes', function(a) {
	var A = 'Lorem ipsum dolor sit amet, ex meis noluisse quaestio pro, possit aeterno no duo. Et mei voluptua interpretaris, alienum suscipit sensibus eu per. Eu quis summo intellegam sed, fugit option quo id, possim maiestatis at vix. Natum theophrastus ne eos, cum eu debet integre constituam. Pri inani iisque ex.';
	var B = 'Lorem ipsum dolor sit amet, ut audiam qualisque duo. Virtute iudicabit iracundia cu sit, te usu eruditi feugait, quando constituam repudiandae eu sit. Ius duis fastidii accommodare ne. Eos petentium erroribus et, quas accusamus qui et. Modo inani corrumpit cu eum, vix volumus abhorreant accommodare cu.';
	
	var diff = ide.diff(A, B);
	
	var C = ide.patch(A, diff);
	a.equal(C, B);
});
