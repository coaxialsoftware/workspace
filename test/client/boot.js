
/*
 * Mocking Data for tests.
 */

window.document.write(
	'<div id="ide-notification"></div>' +
	'<script id="tpl-assist"></script>'
);

$.mockjaxSettings.logging = false;
$.mockjaxSettings.responseTime = 0;
$.mockjax({ url: '/project', responseText: {
	name: 'workspace-test',
	'socket.port': 1000
}});