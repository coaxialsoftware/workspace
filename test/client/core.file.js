
QUnit.module('File');

QUnit.test('File', function(a) {

	var f = new ide.File('test');

	a.equal(f.filename, 'test');
});

QUnit.test('File#fetch() - directory', function(a) {
var
	f = new ide.File('.'),
	done = a.async()
;
	f.fetch().then(function() {
		a.equal(f.mime, 'text/directory');
		a.ok(Array.isArray(f.content));
		a.ok(f.isDirectory());
		a.ok(!f.new);
		a.ok(f.mtime);
		f.destroy();
		done();
	});
});

QUnit.test('File#fetch() - new file', function(a) {
var
	f = new ide.File(a.test.testId),
	done = a.async()
;
	f.fetch().then(function() {
		a.equal(f.mime, 'text/plain');
		a.equal(f.content, '');
		a.ok(f.isNew());
		f.destroy();
		done();
	});
});

QUnit.test('File#fetch() - existing JSON file', function(a) {
var
	f = new ide.File('workspace.json'),
	done = a.async()
;
	f.fetch().then(function() {
		a.equal(f.mime, 'application/json');
		a.equal(f.id, 'workspace.json');
		a.ok(!f.new);
		a.ok(f.mtime);
		f.destroy();
		done();
	});
});

QUnit.test('File#fetch() - Repeated fetching', function(a) {
var
	f = new ide.File('workspace.json'),
	done = a.async()
;
	f.fetch();
	f.fetch().then(function() {
		a.ok(f.id);
		f.destroy();
		done();
	});

});

QUnit.test('File#hasChanged()', function(a) {
var
	f = new ide.File('File#hasChanged'),
	done = a.async(),
	now = Date.now() + a.test.testId
;
	a.ok(!f.hasChanged());
	f.content = 'Hello';
	a.ok(f.hasChanged());
	f.content = '';
	a.ok(!f.hasChanged());

	f.fetch().then(function() {
		a.ok(!f.hasChanged());
		a.ok(!f.isDirectory());
		f.content = now;
		a.ok(f.hasChanged());
		return f.write();
	}).then(function() {
		a.equal(f.content, now);
		a.ok(!f.hasChanged());
		f.destroy();
	}).then(done);
});

QUnit.test('File#write() - Existing File', function(a) {
var
	f = new ide.File('File#write'),
	done = a.async(),
	content = a.test.testId + Date.now(),
	content2 = Date.now() + a.test.testId
;
	f.fetch().then(function() {
		f.content = content;
		return f.write();
	}).then(function() {
		a.equal(f.id, 'File#write');
		a.equal(f.mime, 'text/plain');
		a.equal(f.content, content);

		f.content = content2;

		return f.write();
	}).then(function() {
		a.equal(f.id, 'File#write');
		a.equal(f.content, content2);
		f.destroy();
		done();
	});
});

QUnit.test('File#write() - Directory', function(a) {
var
	f = new ide.File('.'),
	done = a.async()
;
	f.fetch().then(function() {
		return f.write();
	}).catch(function(e) {
		a.equal(e, ide.File.ERROR_WRITE_DIRECTORY);
		a.ok(f.isDirectory());
		f.destroy();
		done();
	});
});

QUnit.test('File#write() - No File Name', function(a) {
var
	f = new ide.File(''),
	done = a.async()
;
	f.write().catch(function(e) {
		a.equal(e, ide.File.ERROR_WRITE_NO_FILENAME);
		f.destroy();
		done();
	});
});

/*QUnit.test('File#onMessageStat() - 2 files', function(a) {
var
	f1 = new ide.File('File#onMessageStat'),
	f2 = new ide.File('File#onMessageStat'),
	done = a.async()
;
	Promise.all([ f1.fetch(), f2.fetch() ]).then(function() {
		a.ok(f1.id === f2.id);
		f1.content = a.test.testId;
	}).then(function() {
		a.ok(f2.outOfSync);
	}).then(done);
});*/

QUnit.test('File#onMessageStat()', function(a) {
var
	notify=ide.notify,
	warn=ide.warn,
	done=a.async(),
	file = new ide.File('File#onMessageStat')
;
	file.fetch().then(function(file) {
		try {
			ide.notify = function notify() { notify.called = true; };
			ide.warn = function warn() { warn.called = true; };

			file.fetch = function fetch() { fetch.called = true; };
			file.onMessageStat({
				f: file.id, t: Date.now()
			});

			a.ok(ide.notify.called);
			a.ok(file.fetch.called);
			a.ok(!file.hasChanged());

			file.content = 'World';

			file.onMessageStat({
				f: file.id, t: Date.now()
			});

			a.ok(ide.warn.called);
			a.ok(file.outOfSync);
		}
		finally {
			file.destroy();
			ide.warn = warn;
			ide.notify = notify;
		}

	}).then(done);

});

QUnit.module('ide.FileEditor');

QUnit.test('ide.FileEditor', function(a) {
var
	file = new ide.File(),
	e = new ide.FileEditor({
		plugin: { name: 'test' },
		file: file
	})
;
	a.equal(e.file, file);
	e.destroy();
});
