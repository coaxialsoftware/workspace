
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

	try {
		return new RegExp(reStr);
	} catch (e) {
		return new RegExp(glob.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&'));
	}
}
	
function getMask(token)
{
	return token.type==='string' ?
		token.string.substr(1, token.string.length-2) : token.string;
}

var frag = cxl.dom('DIV');

ide.Item = cxl.View.extend({

	priority: 0,

	/** Shortcut */
	key: null,

	className: 'log',

	action: null,

	/** Actual value of item. Used when title is different to value */
	value: null,

	loadTemplate: function(tpl)
	{
		// TODO optimize and test
		frag.innerHTML = tpl(this);
		this.setElement(frag.children[0]);
	},

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
				this.onItemClick(ev, this.children[id]);
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
		this.$content.scrollTop += dY;
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

		this.children = this.children ? this._addElements(this.children, 0) : [];
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
		var l = i===undefined ? this.children.length : i, item;

		return items.map(function(f, i) {
			f.id = l + i;
			item = this.createItem(f);
			this.$list.append(item.el);
			return item;
		}, this);
	},

	reset: function()
	{
		_.invokeMap(this.children, 'unbind');
		this.children = [];
		this.$list.empty();
	},

	add: function(items)
	{
		items = this._addElements(items);
		this.children = this.children.concat(items);
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
			i=0, files = this.children,
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
	
var worker = new ide.Worker({
	
	setFiles: function(files)
	{
		this.files = files;
	},
	
	getMask: getMask,
	
	assist: function(data)
	{
	var
		token = data.token,
		str = token && (token.type===null || token.type==='string' ||
			token.type==='string property') && this.getMask(token),
		regex = str && this.globToRegex(str),
		files = this.files,
		result
	;
		if (regex && files)
		{
			result = files.filter(function(val) {
				return regex.test(val.filename);
			});

			if (result.length===1)
				return { title: 'Open file "' + result[0].filename + '"', action: 'find' };
			else if (result.length)
				return { title: 'Find file "' + str + '" (' + result.length +
					' matches)', action: 'find' };
		}
	},
	
	globToRegex: globToRegex
});
	
ide.workerManager.register(worker);

ide.plugins.register('find', new ide.Plugin({

	start: function()
	{
		this.listenTo('project.load', this.onProject);
		this.listenTo('assist.inline', this.onAssistInline);
	},
	
	onProject: function(p)
	{
		worker.post('setFiles', p.attributes.files);
	},
	
	onAssistInline: function(done, editor, token)
	{
		var files, fn = token.state && token.state.fn, str=token.string;

		if ((fn==='e' || fn==='tabe') && str.indexOf('find:')===0)
		{
			fn = 'find';
			str = str.substr(5);
		}

		if (editor === ide.commandBar && fn==='find' && str)
		{
			files = this.find(str);

			if (files && files.length)
				done(files);
		}
	},

	find: function(mask)
	{
	var
		regex = globToRegex(mask),
		files = ide.project.get('files')
	;
		if (files)
			return files.filter(function(val) {
				return regex.test(val.filename);
			}).map(function(val) {
				return val.hint;
			});
	},

	open: function(options)
	{
	var
		token = ide.editor && ide.editor.token,
		mask = options.file || (token && getMask(token)) || '',
		files = this.find(mask).map(function(val) {
			return { title: val.title, icon: val.icon };
		})
	;
		if (!files)
			return ide.warn('[find] No files found in project.');

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
				children: files,
				plugin: this,
				slot: options.slot
			});
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
				children: files,
				title: path,
				prefix: path==='.' ? '' : (path + '/'),
				slot: options.slot
			});
		}
	}

}));

})(this.ide, this.jQuery, this._, this.cxl);
