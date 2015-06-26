
(function(ide, $, _) {
"use strict";

ide.FileList = ide.Editor.extend({

	$content: null,

	list_template: '#tpl-filelist',
	file_template: '#tpl-file',

	title: null,
	path: null,
	files: null,

	/** Compiled file template */
	tpl: null,

	on_click: function(ev)
	{
	var
		data = ev.currentTarget.dataset,
		options = {}
	;
		if (data.line)
			options.line = data.line;

		if (ev.ctrlKey)
			options.target = '_blank';

		ide.open(data.path, options);

		if (!ev.shiftKey)
			ide.workspace.remove(this);
	},

	on_keydown: function(ev)
	{
		var el = this.$el;

		function go(dir)
		{
			el.find(':focus').parent()[dir]().find('a').focus();
			ev.preventDefault();
		}
		if (ev.keyCode===0x26 || ev.keyCode===0x4b)
			go('prev');
		else if (ev.keyCode===0x28 || ev.keyCode===0x4a)
			go('next');
	},

	add_files: function(files)
	{
	var
		result = '',
		i = 0
	;
		for (; i<files.length;i++)
			result += this.tpl(files[i]);

		if (files !== this.files)
			this.files = this.files ? this.files.concat(files) : files;
		this.$content.append(result);
		this.children = this.$content.children();
	},

	findTest: function(regex, file)
	{
		return regex.test(file.filename);
	},

	find: function(regex)
	{
		var i=0, files = this.files, children = this.children, clear=!regex;

		for (; i<files.length; i++)
			children[i].style.display =
				(clear || this.findTest(regex, files[i])) ?
					'block' : 'none';
	},

	focus: function()
	{
		this.$el.find('a:eq(0)').focus();
		ide.Editor.prototype.focus.call(this);
	},

	setup: function()
	{
	var
		me = this,
		tpl = _.template($(me.list_template).html())
	;
		me.$el.addClass('ide-panel').html(tpl({
			title: me.title
		}));

		me.$content = me.$el.find('.filelist-content');

		me.tpl = _.template($(me.file_template).html());

		if (me.files)
			me.add_files(me.files);

		me.$el.on('click', '.content', me.on_click.bind(me));
		me.$el.on('keydown', me.on_keydown.bind(me));
	}
});

ide.plugins.register('find', new ide.Plugin({

	shortcut:
	{
		'gf': function()
		{
			this.open();
		}
	},

	open: function(mask)
	{
		ide.commands.find(mask);
	},

	get_mask: function()
	{
		var token = ide.editor && ide.editor.get_token &&
			ide.editor.get_token();

		if (token)
		{
			return token.type==='string' ?
				token.value.substr(1, token.value.length-2) : token.value;
		}
	},

	commands: { /** @lends ide.commands */

		/**
		 * Finds file by mask and displays all matches, if only one found
		 * it will automatically open it. If not mask is specified it will use
		 * the token under the active editor.
		 */
		find: function(mask)
		{
		var
			regex,
			files = ide.project.get('files')
		;
			mask = mask || this.get_mask() || '';

			regex = new RegExp(mask);

			if (!files)
				return ide.warn('[find] No files found in project.');

			files = files.filter(function(val) {
				return regex.test(val.filename);
			});

			if (files.length===1)
				ide.open(files[0]);
			else if (files.length===0)
				ide.notify('No files found that match "' + mask + '"');
			else
				ide.workspace.add(new ide.FileList({
					file: mask,
					plugin: this,
					files: files,
					title: 'find ' + mask,
					path: ''
				}));
		}

	}

}));

ide.plugins.register('folder', new ide.Plugin({

	edit: function(file, options)
	{
		var editor, files, path;

		if (file.get('directory'))
		{
			files = file.get('content');
			files.unshift({ filename: '..' });

			path = file.get('filename');
			path = path==='.' ? '' : (path + '/');

			editor = new ide.FileList({
				slot: options.slot,
				file: file,
				plugin: this,
				files: files,
				title: file.get('filename'),
				path: path
			});
			ide.workspace.add(editor);
			return true;
		}
	}

}));

})(this.ide, this.jQuery, this._);
