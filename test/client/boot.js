
/*
 * Mocking Data for tests.
 */

(function() {
	
window.document.write(
	'<div style="display:none">' +
	'<div id="notification"></div>' +
	'<div id="command" class="command-bar"><input /></div>' +
	'<div id="search" class="command-bar"><input /></div>' +
	'<div id="assist"></div>' +
	'<div id="welcome"></div>' +
	'<div id="assist-inline"></div>' +
	'<div id="workspace"></div>' +
	'</div>' +
	'<script id="tpl-assist" type="text/template">' +
	'<div &="$$hints"></div></script>' +
	'<script id="tpl-item" type="text/template"><div></div></script>' +
	'<script id="tpl-editor-list" type="text/template"></script>'
);

var ajax = cxl.ajax, mock=[];
	
function mockMatch(p, match)
{
	var rule = match.rule, i;
	
	for (i in rule)
	{
		if (rule[i] instanceof RegExp)
		{
			if (!rule[i].test(p[i]))
				return false;
		}
		else if (rule[i] !== p[i])
			return false;
	}
	
	return true;
}

cxl.ajax = function(p)
{
	var r = mock.find(mockMatch.bind(cxl, p));
	
	if (r)
		return Promise.resolve(cxl.result(r, 'response'));
	
	return ajax.apply(cxl, arguments);
};
	
cxl.ajax.mock = function(rule, response)
{
	var match = { rule: rule, response: response };
	mock.push(match);
	
	return function() {
		var i = mock.indexOf(match);
		mock.splice(i, 1);
	};
};
	
cxl.ajax.mock({
	url: /^\/project/
}, {
	name: 'workspace-test',
	'socket.port': 1000,
	'socket.secure': true
});


})();
