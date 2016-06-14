
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

ide.Item = cxl.View.extend({

	priority: 0,

	/** Shortcut */
	key: null,

	className: 'log',

	action: null,

	/** Actual value of item. Used when title is different to value */
	value: null,

	initialize: function()
	{
		if (!this.key && this.action)
		{
			var key = ide.keyboard.findKey(this.action);
			this.key = key ? key : ':' + this.action;
		}
	},

	remove: function()
	{
		this.$el.remove();
		this.unbind();
	}

});

ide.Notification = ide.Item.extend({

	/** Optional Id for progress hints */
	id: null,

	/**
	 * If present hint will persist until progress becomes 1.
	 * Progress from 0.0 to 1.0. A value of -1 will show a spinner
	 */
	progress: null,

	constructor: function(message, kls)
	{
		if (typeof(message)==='string')
			message = { title: message, className: kls };

		ide.Item.call(this, message);
	}

});


ide.Editor.List = ide.Editor.extend({

	title: '',
	templateId: 'tpl-editor-list',
	itemTemplate: null,
	itemClass: ide.Item,
	items: null,
	html: '',

	$footer: null,

	/// Content DOM element
	$list: null,

	/** @type {function} */
	onItemClick: null,

	onListClick: function(ev)
	{
		this._onClick(ev.currentTarget, ev);
	},

	_onClick: function(target, ev) {
	var
		id = target.dataset.id
	;
		if (id && this.onItemClick)
		{
			if (this.onItemClick)
				this.onItemClick(ev, this.items[id]);
		}

		ev.stopPropagation();
		ev.preventDefault();
	},

	initialize: function()
	{
		this.$el.addClass('panel list');
	},

	onWheel: function(ev)
	{
		var dY = ev.deltaY;
		this.$list[0].scrollTop += dY;
		ev.preventDefault();
	},

	// TODO see if it makes sense to use a keymap for this...
	onKey: function(ev)
	{
		if (ev.keyCode===13)
			this._onClick(ev.target, ev);
	},

	render: function()
	{
		this.listenTo(this.$list, 'wheel', this.onWheel);
		this.listenTo(this.$list, 'keydown', this.onKey);

		this.$list = $(this.$list)
			.on('click', '.item', this.onListClick.bind(this));

		if (this.items)
			this._addElements(this.items, 0);
		else
			this.items = [];
	},

	createItem: function(item)
	{
		if (!(item instanceof this.itemClass))
		{
			if (this.itemTemplate)
				item.template = this.itemTemplate;
			item = new this.itemClass(item);
		}

		return item;
	},

	// TODO support remove?
	_addElements: function(items, i)
	{
		var l = i===undefined ? this.items.length : i, item;

		items.forEach(function(f, i) {
			f.id = l + i;
			item = this.createItem(f);
			this.$list.append(item.el);
		}, this);
	},

	reset: function()
	{
		this.items = [];
		this.$list.empty();
	},

	add: function(items)
	{
		this._addElements(items);
		this.items = this.items.concat(items);
	},

	focus: function()
	{
		this._findFocus().focus();
		ide.Editor.prototype.focus.call(this);
	},

	_findTest: function(regex, file)
	{
		return regex.test(file.title);
	},

	_findFocus: function()
	{
		var focused = this.$list.find(':focus');

		if (!focused.is(':visible'))
			focused = this.$list.find('.item:visible:eq(0)');

		return focused;
	},

	commands: {

		quit: function()
		{
			ide.workspace.remove(this);
		},

		search: function(regex)
		{
		var
			i=0, files = this.items,
			children = this.$list[0].children, clear=!regex
		;
			for (; i<files.length; i++)
				children[i].style.display =
					(clear || this._findTest(regex, files[i])) ?
						'block' : 'none';
		},

		goDocStart: function()
		{
			this.$list.find('.item:visible:eq(0)').focus();
		},

		goDocEnd: function()
		{
			this.$list.find('.item:visible:last-child').focus();
		},

		goLineDown: function(dir)
		{
			dir = dir || 'next';
			this._findFocus()[dir](':visible').focus();
		},

		goLineUp: function()
		{
			this.goLineDown('prev');
		}

	}

});

ide.Editor.FileList = ide.Editor.List.extend({

	// Path prefix
	prefix: null,

	_findTest: function(regex, file)
	{
		return regex.test(file.title);
	},

	onItemClick: function(ev, item)
	{
	var
		title = item.value || item.title,
		options = {
			file: (this.prefix ? this.prefix+'/' : '') + title,
			focus: !ev.shiftKey
		}
	;
		if (item.line)
			options.line = item.line;

		if (ev.ctrlKey)
			options.target = '_blank';

		ide.open(options);

		if (options.focus)
			ide.workspace.remove(this);
	}

});

ide.plugins.register('find', new ide.Plugin({

	start: function()
	{
		this.listenTo('assist', this.onAssist);
	},

	onAssist: function(done, editor, token)
	{
		var str = token && (token.type===null || token.type==='string' ||
			token.type==='string property') && token.string;

		if (str)
			done({
				title: 'Find file ' + str,
				action: 'find'
			});
	},

	open: function(options)
	{
	var
		mask = options.file || this.get_mask() || '',
		regex = globToRegex(mask),
		files = ide.project.get('files')
	;
		if (!files)
			return ide.warn('[find] No files found in project.');

		files = files.filter(function(val) {
			return regex.test(val.filename);
		}).map(function(val) {
			return {
				title: val.filename, className: val.directory ? 'directory' : 'file'
			};
		});

		if (files.length===1)
			ide.open({
				file: files[0].title,
				slot: options.slot
			});
		else if (files.length===0)
			ide.notify('No files found that match "' + mask + '"');
		else
			return new ide.Editor.FileList({
				title: 'find ' + mask,
				file: mask,
				items: files,
				plugin: this,
				slot: options.slot
			});
	},

	get_mask: function()
	{
		var token = ide.editor && ide.editor.token;

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
			return this.open({ file: mask, plugin: this });
		}

	}

}));

ide.plugins.register('folder', new ide.Plugin({

	ready: function()
	{
		// TODO replace with cxl templates
		ide.Editor.List.prototype.itemTemplate = _.template(cxl.html('tpl-item'));
	},

	commands: {

		browse: function()
		{
			ide.open('.');
		}

	},

	edit: function(options)
	{
		var file=options.file, files, path;

		if (file.get('directory'))
		{
			files = file.get('content').map(function(f) {
				return {
					title: f.filename, className: f.directory ? 'directory' : 'file'
				};
			});

			files.unshift({ title: '..', className: 'directory' });
			path = file.get('filename');

			return new ide.Editor.FileList({
				file: file,
				items: files,
				title: path,
				prefix: path==='.' ? '' : (path + '/'),
				slot: options.slot
			});
		}
	}

}));

})(this.ide, this.jQuery, this._, this.cxl);
