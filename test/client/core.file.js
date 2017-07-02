
QUnit.module('File');

QUnit.test('File', function(a) {

	var f = new ide.File('test');

	a.equal(f.name, 'test');
});

QUnit.test('File.joinPath', function(a) {

	a.equal(ide.File.joinPath('hello', 'world'), 'hello/world');
	
});

QUnit.test('File#read() - normalize', function(a) {
var
	f = new ide.File(ide.File.joinPath('empty-project', '..', 'empty-project', '..')),
	done = a.async(),
	id = ide.project.id,
	promise
;
	f.read().then(function() {
		a.equal(f.name, '.');
		a.equal(f.path, '.');

		f = new ide.File(ide.File.joinPath('empty-project', '..', 'File#write'));
		return f.read();
	}).then(function() {
		a.equal(f.name, 'File#write');
		a.equal(f.path, 'File#write');

		try {
			ide.project.set('path', 'empty-project');
			f = new ide.File(ide.File.joinPath('..', 'empty-project', 'invalid', '..'));
			promise = f.read();
		} finally {
			ide.project.set('path', id);
		}

		return promise;
	}).then(function() {
		a.equal(f.name, '.');
		a.equal(f.path, 'empty-project');
	}).then(done);
});

QUnit.test('File#read() - directory', function(a) {
var
	f = new ide.File('.'),
	done = a.async()
;
	f.read().then(function() {
		a.equal(f.mime, 'text/directory');
		a.ok(Array.isArray(f.content));
		a.ok(f.stat.isDirectory);
		a.ok(!f.new);
		a.ok(f.stat.mtime);
		a.ok(f.stat.atime);
		a.ok(f.stat.ctime);
		done();
	});
});

QUnit.test('File#read() - new file', function(a) {
var
	f = new ide.File(a.test.testId),
	done = a.async()
;
	f.read().then(function() {
		a.equal(f.mime, 'text/plain');
		a.equal(f.content.byteLength, 0);
		a.ok(f.stat.isNew);
		return f.read('utf8');
	}).then(function() {
		a.equal(f.encoding, 'utf8');
		a.equal(f.content, '');
		done();
	});
});

QUnit.test('File#read() - existing JSON file', function(a) {
var
	f = new ide.File('workspace.json'),
	done = a.async()
;
	f.read().then(function() {
		a.equal(f.mime, 'application/json');
		a.equal(f.path, 'workspace.json');
		a.ok(!f.stat.isNew);
		a.ok(f.stat.mtime);
		done();
	});
});

QUnit.test('File#read() - Repeated fetching', function(a) {
var
	f = new ide.File('workspace.json'),
	done = a.async()
;
	f.read();
	f.read().then(function() {
		a.ok(f.path);
		done();
	});

});

QUnit.test('File#write() - Contents have changed', function(a) {
var
	f = new ide.File('File#writeHasChanged'),
	f2 = new ide.File('File#writeHasChanged'),
	content = a.test.testId + Date.now(),
	done = a.async()
;
	f.read('utf8').then(function() {
		return f.write(content);
	}).then(function() {
		a.equal(f.content, content);
		return f2.write('Should not write');
	}).catch(done);
});

QUnit.test('File#write() - Existing File', function(a) {
var
	f = new ide.File('File#write'),
	done = a.async(),
	content = a.test.testId + Date.now(),
	content2 = Date.now() + a.test.testId
;
	f.read('utf8').then(function() {
		return f.write(content);
	}).then(function() {
		a.equal(f.path, 'File#write');
		a.equal(f.mime, 'text/plain');
		a.equal(f.content, content);

		return f.write(content2);
	}).then(function() {
		a.equal(f.path, 'File#write');
		a.equal(f.content, content2);
		done();
	});
});

QUnit.test('File#write() - Empty file', function(a) {
var
	f = new ide.File('File#writeEmpty'),
	done = a.async(),
	content = ''
;
	f.read('utf8').then(function() {
		f.content = content;
		return f.write();
	}).then(function() {
		a.equal(f.path, 'File#writeEmpty');
		a.equal(f.content, content);
	}).then(done);
});

QUnit.test('File#write() - Directory', function(a) {
var
	f = new ide.File('.'),
	done = a.async()
;
	f.read().then(function() {
		return f.write();
	}).catch(function(e) {
		a.equal(e, ide.File.ERROR_WRITE_DIRECTORY);
		a.ok(f.stat.isDirectory);
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
		done();
	});
});

QUnit.test('File#delete()', function(a) {
var
	f = new ide.File('File#delete'),
	done = a.async(),
	content = 'Testing Content'
;
	f.read('utf8').then(function() {
		return f.write(content);
	}).then(function() {
		a.equal(f.path, 'File#delete');
		a.equal(f.content, content);
		return f.delete();
	}).then(function() {
		a.equal(f.path, 'File#delete');
		a.equal(f.content.byteLength, 0);
		a.ok(f.stat.isNew);
	}).then(done);
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

QUnit.module('FileFeature');

QUnit.test('FileFeature#constructor()', function(a) {
var
	e = {},
	options = { encoding: 'latin1' },
	f = new ide.feature.FileFeature(e, options)
;
	a.equal(f.editor, e);
	a.equal(f.encoding, 'latin1');
	a.equal(e.file, f);
	f.destroy();
});

QUnit.test('FileFeature#render()', function(a) {
var
	file = new ide.File('FileFeature#render'),
	content = a.test.testId + Date.now(),
	config = { file: file, encoding: 'utf8' },
	editor = new ide.Editor(config),
	feature = new ide.feature.FileFeature(editor, config),
	done = a.async()
;
	file.read().then(function() {
		return file.write(content);
	}).then(function() {
		feature.render();
		a.equal(feature.content, content);
		a.ok(!feature.hasChanged());
		editor.destroy();
	}).then(done);
});

QUnit.test('FileFeature#hasChanged()', function(a) {
var
	file = new ide.File('File#hasChanged'),
	editor = new ide.Editor({}),
	options = { file: file, encoding: 'utf8' },
	feature = new ide.feature.FileFeature(editor, options),
	done = a.async(),
	now = Date.now() + a.test.testId
;
	feature.render();
	
	a.ok(!feature.hasChanged());
	feature.content = 'Hello';
	a.ok(feature.hasChanged());
	feature.content = '';
	a.ok(!feature.hasChanged());

	file.read().then(function() {
		a.ok(!feature.hasChanged());
		a.ok(!feature.stat.isDirectory);
		feature.content = now;
		a.ok(feature.hasChanged());
		return feature.write();
	}).then(function() {
		a.equal(feature.content, now);
		a.ok(!feature.hasChanged());
		editor.destroy();
	}).then(done);
});

QUnit.module('FileSync');

QUnit.test('FileSync#onMessageStat()', function(a) {
var
	notify=ide.notify,
	warn=ide.warn,
	file = new ide.File('File#hasChanged'),
	editor = new ide.Editor({}),
	options = { file: file },
	feature = new ide.feature.FileFeature(editor, options),
	done = a.async()
;
	file.read().then(function(file) {
		try {
			ide.notify = function notify() { notify.called = true; };
			ide.warn = function warn() { warn.called = true; };

			feature.read = function fetch() { fetch.called = true; };
			
			feature.render();
			
			feature.$sync.$onMessageStat({
				f: file.path, t: Date.now()
			});

			a.ok(ide.notify.called);
			a.ok(feature.read.called);
			a.ok(!feature.hasChanged());

			feature.content = 'World';

			feature.$sync.$onMessageStat({
				f: file.path, t: Date.now()
			});

			a.ok(ide.warn.called);
			a.ok(feature.$sync.outOfSync);
		}
		finally {
			editor.destroy();
			ide.warn = warn;
			ide.notify = notify;
		}

	}).then(done);

});


QUnit.module('ide.FileEditor');

QUnit.test('ide.FileEditor - not loaded file', function(a) {
var
	file = new ide.File(),
	e = new ide.FileEditor({
		file: file
	})
;
	a.equal(e.file.$file, file);
	e.destroy();
});
