
QUnit.module('File');

QUnit.test('File', function(a) {
	
	var f = new ide.File('test');
	
	a.equal(f.filename, 'test');
	a.ok(f.hint);
});

QUnit.test('File#url()', function(a) {
	ide.project.attributes.path = 'test_project';
	var f= new ide.File('test');
	
	a.equal(f.url().indexOf('/file?p=test_project&n=test'), 0);
});

QUnit.test('File#fetch()', function(a) {
var
	f = new ide.File('test'),
	done = a.async(),
	ajax = cxl.ajax
;
	cxl.ajax = function() {
		return Promise.resolve({
			filename: 'test',
			mime: 'text/plain',
			content: 'Hello World'
		});
	};
	
	f.fetch().then(function() {
		a.equal(f.mime, 'text/plain');
		a.equal(f.content, 'Hello World');
	}).then(done);

	cxl.ajax = ajax;
});

QUnit.test('File#save()', function(a) {
var
	f = new ide.File('test'),
	done = a.async(),
	ajax = cxl.ajax,
	request
;
	cxl.ajax = function(p) {
		request = p;
		return Promise.resolve({
			filename: 'test',
			path: 'test',
			mime: 'text/plain',
			content: 'Hello World'
		});
	};
	
	f.save().then(function() {
		a.equal(f.id, 'test');
		a.equal(f.mime, 'text/plain');
		a.equal(f.content, 'Hello World');
		a.equal(request.method, 'POST');
		
		f.save().then(function() {
			a.equal(f.id, 'test');
			a.equal(request.method, 'PUT');
			cxl.ajax = ajax;
		}).then(done);
	});

});

QUnit.test('File#hasChanged()', function(a) {
var
	f = new ide.File('test'),
	ajax = cxl.ajax,
	done = a.async()
;
	cxl.ajax = function(p) {
		request = p;
		return Promise.resolve({
			filename: 'test',
			path: 'test',
			mime: 'text/plain',
			content: 'Hello'
		});
	};
	
	a.ok(!f.hasChanged());
	f.content = 'Hello';
	a.ok(f.hasChanged());
	
	f.save().then(function() {
		a.ok(!f.hasChanged());
	}).then(done);
	
	cxl.ajax = ajax;
	
});

QUnit.module('FileManager');

QUnit.test('FileManager#getFile()', function(a) {
	
	var f = ide.fileManager.getFile('test');
	
	a.equal(f.filename, 'test');
	
});

QUnit.test('FileManager#onMessageStat()', function(a) {
	var notify=ide.notify, warn=ide.warn, ajax=cxl.ajax, done=a.async();
	
	cxl.ajax = function(p) {
		request = p;
		return Promise.resolve({
			filename: 'test',
			path: 'test',
			mime: 'text/plain',
			content: 'Hello'
		});
	};
	
	ide.notify = function notify() { notify.called = true; };
	ide.warn = function warn() { warn.called = true; };
	
	ide.open('test').then(function(e) {
		a.ok(ide.workspace.editors.length);

		ide.fileManager.onMessageStat({
			f: 'test', t: Date.now()
		});

		a.ok(ide.notify.called);
		a.ok(!e.file.hasChanged());
		
		e.file.content = 'World';
		
		ide.fileManager.onMessageStat({
			f: 'test', t: Date.now()
		});
		
		a.ok(ide.warn.called);
		a.ok(e.file.old);
		
		ide.warn = warn;
		ide.notify = notify;
		cxl.ajax = ajax;
		
		e.file.content = 'Hello';
		e.quit();
	}).then(done);

});

/*QUnit.test('Handle opening file fatal error.', function(a) {
	var f = new ide.File();
	f.fetch({ error: a.async() });
	a.ok(f);
});

QUnit.test('Handle saving file fatal error.', function(a) {
	var f = new ide.File();
	f.on('error', a.async());
	f.save();
	a.ok(f);
});*/