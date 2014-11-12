
(function(ide, require) {
"use strict";

ide.plugins.register('html', new ide.Plugin({

	/// Autocomplete plugin
	plugin: null,

	autocomplete: function(editor)
	{
	var
		Mode = require('ace/mode/html_completions').HtmlCompletions,
		mode = new Mode(),
		pos = editor.get_position(),
		token = editor.get_token(),
		session = editor.editor.session,
		state = session.getState(pos.row),
		result=[], prefix, completions, i, c
	;
		if (!token)
			return;

		prefix = new RegExp('^' + token.value.slice(0, pos.column - token.start));
		completions = mode.getCompletions(state, session, pos, prefix);

		for (i=0;i<completions.length; i++)
		{
			c = completions[i].value || completions[i].caption;

			if (prefix.test(c))
				result.push('<button data-value="' + c + '">' + c + '</button>');
		}

		if (result.length)
			this.plugin.add(result.join(''));
	},

	ready: function()
	{
		this.plugin = ide.plugins.get('autocomplete').register('text/html', this);
	}

}));

})(this.ide, this.require);