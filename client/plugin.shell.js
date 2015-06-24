
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

	editor.add_files(result);
}

function cmd(name, args, onprogress)
{
	args = Array.prototype.slice.call(args, 0);
	ide.shell(name, args, onprogress)
		.then(function(response) {
			ide.open({
				file: name + ' ' + args.join(' '),
				content: response, mime: 'text/plain',
				new: true
			});
		})
	;
}

ide.plugins.register('shell', new ide.Plugin({

	open: function(cmd)
	{
		ide.cmd(cmd);
	},

	commands: {

		mkdir: function()
		{
			ide.shell('mkdir', Array.prototype.slice.call(arguments, 0))
				.then(ide.notify.bind(this, "[shell] mkdir success."));
		},

		svn: function()
		{
			cmd('svn', arguments);
		},

		git: function()
		{
			cmd('git', arguments);
		},

		grunt: function()
		{
			cmd('grunt', arguments);
		},

		grep: function(term)
		{
		var
			pos = 0,
			exclude = ide.project.get('ignore'),
			args = [],
			env = ide.project.get('env'),

			editor = new ide.FileList({
				file: 'grep ' + term,
				plugin: this,
				file_template: '#tpl-grep',
				title: 'grep ' + term,
				path: /^(?:\.\/)?(.+):(\d+):\s*(.+)\s*/
			})
		;
			args.push('-0rnIP');

			if (exclude instanceof Array)
				exclude.forEach(function(f) {
					var d = f.replace(/ /g, '\\ ').replace(/\/$/, '');
					args.push('--exclude-dir=' + d + '',
						'--exclude=' + d);
				});

			// Fix for linux?
			args.push(term, env && env.WINDIR ? '*' : '.');

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