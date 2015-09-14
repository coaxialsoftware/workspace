
(function(ide, $, _, cxl) {
"use strict";
	
function globToRegex(glob) {
var
	// The regexp we are building, as a string.
	reStr = "",

	// If we are doing extended matching, this boolean is true when we are inside
	// a group (eg {*.html,*.js}), and false otherwise.
	inGroup = false,

	c, len = glob.length, i=0
;
	
	for (;i < len; i++) {
		c = glob[i];

		switch (c) {
			case "\\": case "/": case "$":
			case "^": case "+": case ".": case "(":
			case ")": case "=": case "!": case "|":
				reStr += "\\" + c;
				break;
			case "?":
				reStr += ".";
				break;
			case "[":
			case "]":
				reStr += c;
				break;
			case "{":
				inGroup = true;
				reStr += "(";
				break;
			case "}":
				inGroup = false;
				reStr += ")";
				break;
			case ",":
				if (inGroup) {
					reStr += "|";
					break;
				}
				reStr += "\\" + c;
				break;

			case "*":
				reStr += ".*";
				break;

			default:
				reStr += c;
		}
	}

	return new RegExp(reStr);
}
	
ide.ItemList = ide.Editor.extend({
	
	itemTemplate: null,
	list: null,
	
	quit: function()
	{
		ide.workspace.remove(this);
	},
	
	_setup: function()
	{
		if (!this.template)
			this.template = cxl.template('tpl-itemlist');
		if (!this.itemTemplate)
			this.itemTemplate = cxl.template('tpl-item');
	}
	
});
	
ide.FileList = ide.Editor.extend({

	$content: null,

	list_template: '#tpl-filelist',
	file_template: '#tpl-file',

	title: null,
	path: null,
	files: null,

	/** Compiled file template */
	tpl: null,

	_on_click: function(ev)
	{
	var
		data = ev.currentTarget.dataset,
		options
	;
		this.focus();
		
		if (data.path)
		{
			options = {};

			if (data.line)
				options.line = data.line;

			if (ev.ctrlKey)
				options.target = '_blank';

			ide.open(data.path, options);

			if (!ev.shiftKey)
				ide.workspace.remove(this);
		} else if (data.action)
			ide.cmd(data.action);
		else
			return;
	
		ev.stopPropagation();
		ev.preventDefault();
	},
	
	_find_focus: function()
	{
		var focused = this.$el.find(':focus');
		if (!focused.is(':visible'))
			focused = this.$el.find('.content:visible:eq(0)');
		
		return focused;
	},
	
	goDocStart: function()
	{
		this.$el.find('.content:visible:eq(0)').focus();
	},
	
	goDocEnd: function()
	{
		this.$el.find('.content:visible:last-child').focus();
	},
	
	goLineDown: function(dir)
	{
		dir = dir || 'next';
		this._find_focus().parent()[dir]().find('.content:visible').focus();
	},
	
	goLineUp: function()
	{
		this.goLineDown('prev');
	},

	addFiles: function(files)
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
		
		this._find_focus().focus();
	},

	_findTest: function(regex, file)
	{
		return regex.test(file.filename);
	},

	search: function(regex)
	{
		var i=0, files = this.files, children = this.children, clear=!regex;

		for (; i<files.length; i++)
			children[i].style.display =
				(clear || this._findTest(regex, files[i])) ?
					'block' : 'none';
	},

	focus: function()
	{
		this._find_focus().focus();
		ide.Editor.prototype.focus.call(this);
	},

	_setup: function()
	{
	var
		me = this,
		tpl = _.template($(me.list_template).html())
	;
		me.$el.addClass('ide-panel').html(tpl(this));
		me.$content = me.$el.find('.filelist-content');
		me.tpl = _.template($(me.file_template).html());

		if (me.files)
			me.addFiles(me.files);

		me.$el.on('click', '.content', me._on_click.bind(me));
	}
});

ide.plugins.register('find', new ide.Plugin({

	open: function(mask)
	{
		ide.commands.find(mask);
	},

	get_mask: function()
	{
		var token = ide.editor && ide.editor.getToken &&
			ide.editor.getToken();

		if (token)
		{
			return token.type==='string' ?
				// TODO make more generic?
				token.string.substr(1, token.string.length-2) : token.string;
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
			files = ide.project.files_json
		;
			mask = mask || this.get_mask() || '';

			regex = globToRegex(mask);

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
	
	commands: {
		
		browse: function()
		{
			ide.open('.');
		}
		
	},

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

})(this.ide, this.jQuery, this._, this.cxl);
