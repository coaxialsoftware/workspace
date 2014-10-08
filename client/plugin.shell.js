
(function(ide, Backbone, $, undefined) {
"use strict";

/**
 * Calls shell service and returns a Promise.
 */
ide.shell = function(cmd, args, onprogress)
{
	return $.ajax({
		url: '/shell',
		data: JSON.stringify({ c: cmd, q: args, p: ide.project.get('path') }),
		contentType: 'application/json',
		type: 'POST',
		xhr: function()
		{
			var xhr = $.ajaxSettings.xhr();
			if (onprogress)
	            xhr.addEventListener('progress', onprogress);
	        return xhr;
		}
	}).fail(function(xhr) {
		ide.error(xhr.responseText);
	});
};

function grepDone(editor, result)
{
	result = result.split("\n");

	editor.addFiles(result);
}

function cmd(name, args, onprogress)
{
	ide.shell(name, Array.prototype.slice.call(args, 0), onprogress)
		.then(function(response) {
			ide.open({
				content: response, mime: 'text/plain',
				path: ide.project.get('path'),
				new: true
			});
		})
	;
}

ide.plugins.register('shell', new ide.Plugin({

	commands: {

		svn: function()
		{
			cmd('svn', arguments);
		},

		git: function()
		{
			cmd('git', arguments);
		},

		grep: function(term)
		{
		var
			pos = 0,
			exclude = ide.project.get('ignore'),
			ignore = ide.project.get('ignore_regex'),
			args = [],

			editor = new ide.FileList({
				file_template: '#tpl-grep',
				title: 'grep ' + term,
				path: /^(.+):(\d+):\s*(.+)\s*/,
				ignore: ignore ? new RegExp(ignore) : undefined
			})
		;
			args.push(term, '-0rnIP');

			if (exclude instanceof Array)
				exclude.forEach(function(f) {
					var d = f.replace(/ /g, '\\ ').replace(/\/$/, '');
					args.push('--exclude-dir=' + d + '',
						'--exclude=' + d);
				});

			args.push('*');

			ide.workspace.add(editor);

			ide.shell('grep', args, function(a)
			{
				var eol = a.target.responseText.lastIndexOf("\n") || a.loaded;

				grepDone(editor, a.target.responseText.slice(pos, eol));
				pos = eol+1;
			}).then(function(text) {
				grepDone(editor, text.slice(pos));
			});
		}

	}


}));

})(this.ide, this.Backbone, this.jQuery);