
QUnit.module('core.diff');

QUnit.test('diff - append string beginning', function(a) {
	var A = "Hello World", B = "World";
	var diff = ide.diff(A, B);
	
	a.equal(diff[0], "");
	a.equal(diff[1], 0);
	a.equal(diff[2], 6);
	
	var C = ide.patch(A, diff);
	a.equal(C, B);
});

QUnit.test('diff - remove string end', function(a) {
	var A = "Hello World", B = "Hello";
	var diff = ide.diff(A, B);
	
	a.equal(diff[0], '');
	a.equal(diff[1], 5);
	a.equal(diff[2], 6);
	
	var C = ide.patch(A, diff);
	a.equal(C, B);
});

QUnit.test('diff - remove string mid', function(a) {
	var A = "Hello World", B = "Hell orld";
	var diff = ide.diff(A, B);
	
	var C = ide.patch(A, diff);
	a.equal(C, B);
});

QUnit.test('diff - remove/add string', function(a) {
	var A = "Hello World", B = "Hell world";
	var diff = ide.diff(A, B);
	
	var C = ide.patch(A, diff);
	a.equal(C, B);
});

QUnit.test('diff - remove/add string', function(a) {
	var A = "Hello World", B = "Hell world";
	var diff = ide.diff(A, B);
	
	var C = ide.patch(A, diff);
	a.equal(C, B);
});

QUnit.test('diff - remove/add 2 strings', function(a) {
	var A = "Hello World Foo Bar", B = "Hell world Food Fighters";
	var diff = ide.diff(A, B);
	
	var C = ide.patch(A, diff);
	a.equal(C, B);
});

QUnit.test('diff - same', function(a) {
	var A = "Hello World", B = "Hello World";
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

QUnit.test('diff - minl', function(a) {
	var A = "Lorem ipsum dolor sit amet\n" +
		"ex meis noluisse quaestio pro\n" +
		"possit aeterno no duo\n" +
		"Et mei voluptua interpretaris\n" +
		"alienum suscipit sensibus eu per\n" +
		"Eu quis summo intellegam sed\n" +
		"fugit option quo id\n" +
		"possim maiestatis at vix.";

	var B = "Lorem ipsum dolor sit amet\n" +
		"ut audiam qualisque duo\n" +
		"possit aeterno no duo\n" +
		"te usu eruditi feugait\n" +
		"Eos petentium erroribus et\n" +
		"Eu quis summo intellegam sed\n" +
		"fugit option quo id\n" +
		"vix volumus abhorreant accommodare cu.";
	
	var diff = ide.diff(A, B, 5);
	
	var C = ide.patch(A, diff);
	a.equal(C, B);
});