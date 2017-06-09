
/*
 * Mocking Data for tests.
 */

(function() {

QUnit.config.autostart = false;

window.document.write(
	'<div style="display:none">' +
	'<div id="notification"></div>' +
	'<div id="command" class="command-bar"><input /></div>' +
	'<div id="search" class="command-bar"><input /></div>' +
	'<div id="assist"></div>' +
	'<div id="welcome"></div>' +
	'<div id="assist-inline"></div>' +
	'<div id="workspace"></div>' +
	'</div><style id="styles"></style>' +
	'<script id="tpl-assist" type="text/template">' +
	'<div &="$$hints"></div></script>' +
	'<script id="tpl-item" type="text/template"><div></div></script>' +
	'<script id="tpl-editor-list" type="text/template"></script>'
);

var ajax = cxl.ajax.xhr, mock=[];

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

cxl.ajax.xhr = function(p)
{
	var r = mock.find(mockMatch.bind(cxl, p));

	if (r)
	{
		var xhr = {
			responseText: JSON.stringify(cxl.result(r, 'response')),
			getResponseHeader: function() { return 'application/json'; }
		};

		return Promise.resolve(xhr);
	}

	return ajax.apply(cxl.ajax, arguments);
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

})();
