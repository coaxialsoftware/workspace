
(function(ide, Backbone, $, undefined) {
"use strict";

/**
 * Calls shell service and returns a Promise.
 */
ide.shell = function(cmd, args, onprogress)
{
	return $.ajax({
		url: '/shell',
		data: JSON.stringify({ c: cmd, q: args }),
		contentType: 'application/json',
		type: 'POST',
		xhr: function()
		{
			var xhr = $.ajaxSettings.xhr();
			if (onprogress)
	            xhr.addEventListener('progress', onprogress);
	        return xhr;
		}
	});
};

function grepDone(editor, result)
{
	result = result.split("\n");

	editor.addFiles(result);
}

ide.plugins.register('shell', new ide.Plugin({

	commands: {

		grep: function(term)
		{
		var
			pos = 0,
			editor = new ide.FileList({
				file_template: '#tpl-grep',
				title: 'grep ' + term,
				on_click: function() { }
			}),
			exclude = ide.project.get('ignore'),
			path = ide.project.get('path')
		;

			ide.workspace.add(editor);

			ide.shell('grep', [
				term,
				'-0rnIoP',
				exclude ? '--exclude="' + exclude.replace(/"/g, '\"') + '"' : undefined,
				path
			],
				function(a) {
					var eol = a.target.responseText.lastIndexOf("\n") || a.loaded;

					grepDone(editor, a.target.responseText.slice(pos, eol));
					pos = eol+1;
				}
			);
		}

	}


}));

})(this.ide, this.Backbone, this.jQuery);