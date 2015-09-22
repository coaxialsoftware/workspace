
/*
 * Mocking Data for tests.
 */

window.document.write(
	'<div style="display:none"><div id="notification"></div>' +
	'<script id="tpl-assist"></script></div>'
);

$.mockjaxSettings.logging = false;
$.mockjaxSettings.responseTime = 0;
$.mockjax({ url: '/project', responseText: {
	name: 'workspace-test',
	'socket.port': 1000
}});