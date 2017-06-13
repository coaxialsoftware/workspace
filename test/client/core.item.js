
QUnit.module('core.item');

QUnit.test('Item', function(a) {

	var item = new ide.Item({});

	a.equal(item.priority, 0);

	item.render();

	a.ok(item.el);

	item = new ide.Item({
		priority: 10,
		className: 'error',
		title: 'Hello',
		value: 'World',
		action: 'test',
		code: 'Code'
	});

	item.render();

	a.equal(item.priority, 10);
	a.equal(item.title, 'Hello');
	a.equal(item.value, 'World');
	a.equal(item.action, 'test');
	a.equal(item.key, ':test');
	a.equal(item.code, 'Code');

	item = new ide.Item({
		title: 'Hello'
	});

	a.equal(item.title, 'Hello');
	a.equal(item.value, 'Hello');

});

QUnit.test('Item#icon', function(a) {

	var item = new ide.Item({ icon: 'tag' });

	item.render();

	a.ok(item.iconEl);

});

QUnit.test('Notification', function(a) {

	var item = new ide.Notification("Hello World", 'error');

	a.equal(item.title, 'Hello World');
	a.equal(item.className, 'error');

});
