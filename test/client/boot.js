
/*
 * Mocking Data for tests.
 */

window.document.write(
	'<div style="display:none">' +
	'<div id="notification"></div>' + 
	'<div id="workspace"></div>' + 
	'</div>' +
	'<script id="tpl-assist" type="text/template">' +
	'<div &="$$hints"></div></script>' + 
	'<script id="tpl-item" type="text/template"><div></div></script>' + 
	'<script id="tpl-editor-list" type="text/template"></script>'
);

$.mockjaxSettings.logging = false;
$.mockjaxSettings.responseTime = 0;
$.mockjax({ url: '/project', responseText: {
	name: 'workspace-test',
	'socket.port': 1000,
	'socket.secure': true
}});