
/*
 * Mocking Data for tests.
 */

$.mockjaxSettings.logging = false;
$.mockjaxSettings.responseTime = 0;
$.mockjax({ url: '/project', responseText: {
	name: 'workspace-test',
	'socket.port': 1000
}});