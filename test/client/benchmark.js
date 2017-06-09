
QUnit.module('benchmark');

function perf(a, count, maxTime, fn)
{
	var time = performance.now();
	console.profile();

	while (count--)
		fn();

	console.profileEnd();
	time = performance.now() - time;

	a.ok(time < maxTime, 'Time: ' + time + ', Max Time: ' + maxTime);
}

QUnit.test('Hint rendering', function(a) {

	perf(a, 10000, 250, function() {
		var x = new ide.Hint({ title: 'Testing Performance' });
		x.render();
	});

});