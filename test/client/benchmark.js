/*jshint esnext:true */
QUnit.module('benchmark');

function perfCollect(count, fn)
{
	var results=[];

	while (count--)
		results.push(fn());

	return results;
}

function perfCallback(a, count, maxTime)
{
	var time = performance.now();
	
	return function(results) {
		time = (performance.now() - time) / count;
		a.ok(time < maxTime, `Time: ${time}, Max Time: ${maxTime}, Count: ${count}`);
		return results;
	};
}

function perfSync(a, count, maxTime, fn)
{
var
	cb = perfCallback(a, count, maxTime),
	results = perfCollect(count, fn)
;
	return Promise.all(results).then(cb);
}

function perfPrepare(a, fn)
{
	return Promise.all([ fn(), fn() ]).then(function() {
		a.step('Done Warming Up');
	});
}

function perf(a, count, maxTime, fn)
{
	var done=a.async();
	
	return perfPrepare(a, fn).then(() => perfSync(a, count, maxTime, fn)).then(done);
}

QUnit.test('Hint rendering', function(a) {

	perf(a, 10000, 250, function() {
		var x = new ide.Hint({ title: 'Testing Performance' });
		x.render();
	});

});

QUnit.test('Diff', function(a) {
var
	A = new ide.File('diff.test3'),
	B = new ide.File('diff.test4'),
	done = a.async()
;
	Promise.all([ A.read('utf8'), B.read('utf8') ]).then(function(files) {
		return perf(a, 10, 1000, function() {
			var diff = ide.diff(A.content, B.content);
			a.equal(B.content, ide.patch(A.content, diff));
		});
	}).then(done);
});

QUnit.test('Diff - Worker post', function(a) {
var
	A = new ide.File('diff.test3'),
	B = new ide.File('diff.test4'),
	done = a.async(),
	count = 20,
	cb
;
	function onDiff(diff)
	{
		var C = ide.patch(A.content, diff);
		a.equal(B.content, C);
		count--;
		
		if (count=== 0)
		{
			cb();
			done();
		}
	}
	
	function go()
	{
		ide.diffWorker.post('diff', [A.content, B.content], onDiff);
	}
	
	function test()
	{
		ide.diffWorker.post('diff', [A.content, B.content]);
	}
	
	Promise.all([ A.read('utf8'), B.read('utf8'), perfPrepare(a, test) ])
		.then(function(files) {
			cb = perfCallback(a, count, 1000);

			perfCollect(count, go);
		});
});

QUnit.test('Diff - Worker', function(a) {
var
	A = new ide.File('diff.test3'),
	B = new ide.File('diff.test4')
;
	perf(a, 20, 1000, function() {
		return Promise.all([ A.read('utf8'), B.read('utf8') ]).then(function(files) {
			return ide.diffWorker.promise('diff', [A.content, B.content]);
		}).then(function(diff) {
			var C = ide.patch(A.content, diff);
			a.equal(B.content, C);
		});
	});
	
});