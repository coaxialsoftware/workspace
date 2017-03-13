
(function(ide, cxl) {
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
	
class ListEditor extends ide.Editor {
	
	initialize(p)
	{
		this.children = p.children;
	}

	onListClick(ev)
	{
		if (!this.onItemClick)
			return;
		
		var target = ev.target;
		
		while (!target.$item && target!==this.el)
			target = target.parentNode;
		
		if (target.$item)
			this.onItemClick(ev, target.$item);
			
		ev.preventDefault();
	}

	render()
	{
		super.render();
		this.el.classList.add('list');
		this.$list = document.createElement('ide-editor-list');
		this.$footer = document.createElement('ide-editor-footer');
		
		this.$content.appendChild(this.$list);
		this.$content.appendChild(this.$footer);
		
		this.listenTo(this.$content, 'wheel', this.onWheel);
		this.listenTo(this.$content, 'keydown', this.onKey);
		this.listenTo(this.$content, 'click', this.onListClick);

		this.children = this.children ? this._addElements(this.children, 0) : [];
	}

	onWheel(ev)
	{
		var dY = ev.deltaY;
		this.$content.scrollTop += dY;
		ev.preventDefault();
	}

	// TODO see if it makes sense to use a keymap for this...
	onKey(ev)
	{
		if (ev.keyCode===13)
			this._onClick(ev.target, ev);
	}

	// TODO support remove?
	_addElements(items)
	{
		return items.map(function(item) {
			this.$list.appendChild(item.el);
			item.el.$item = item;
			return item;
		}, this);
	}

	reset()
	{
		cxl.invokeMap(this.children, 'destroy');
		this.children = [];
		this.$list.innerHTML = '';
	}

	add(items)
	{
		items = this._addElements(items);
		this.children = this.children.concat(items);
	}

	focus()
	{
		var i = this._findFocus();
		
		if (i)
			i.el.focus();
		
		ide.Editor.prototype.focus.call(this);
	}

	_findTest(regex, file)
	{
		return regex.test(file.title);
	}

	_findFocus()
	{
		return this.children.find(function(i) {
			return i.el.matches(':focus') && i.el.style.display!=='none';
		});
	}
	
	_findFirst()
	{
		return this.children.find(function(i) {
			return i.el.style.display!=='none';
		});
	}
	
	_findLast()
	{
		var l = this.children.length;
		
		while (l--)
			if (this.children[l].el.style.display!=='none')
				return this.children[l];
	}
	
	search(regex)
	{
	var
		i=0, files = this.children,
		children = this.$list.children, clear=!regex
	;
		for (; i<files.length; i++)
			children[i].style.display =
				(clear || this._findTest(regex, files[i])) ?
					'block' : 'none';
	}



}
	
ListEditor.registerCommands({
	
	goDocStart: function()
	{
		var c = this._findFirst();

		if (c)
			c.el.focus();
	},

	goDocEnd: function()
	{
		var c = this._findLast();

		if (c)
			c.el.focus();
	},

	goLineDown: function(dir)
	{
		var i = this._findFocus();

		if (i)
		{
			dir = dir || 'nextSibling';
			i=i.el;

			while ((i = i[dir]))
			{
				if (i.style.display!=='none')
					break;
			}
		} else
		{
			i = this._findFirst();
			i = i && i.el;
		}

		if (i)
			i.focus();
	},

	goLineUp: function()
	{
		this.goLineDown('previousSibling');
	}
	
});
	
class FileListEditor extends ListEditor {
	
	constructor(p)
	{
		super(p);
		
		this.file = p.file;
		this.prefix = p.prefix;
		this.getHash = ide.FileEditor.prototype.getHash;
	}

	_findTest(regex, file)
	{
		return regex.test(file.title);
	}

	onItemClick(ev, item)
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
			this.quit();
	}

}
	
var worker = new ide.Worker({
	
	setFiles: function(files)
	{
		this.files = files;
	},
	
	getMask: getMask,
	
	canAssist: function(data)
	{
		var token = data.token;
		return token && (token.type===null || token.type==='string' ||
			token.type==='string property');
	},
	
	assist: function(data)
	{
	var
		token = data.token,
		str = this.getMask(token),
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

		if (editor === ide.commandBar && str)
		{
			if ((fn==='e' || fn==='tabe') && str.indexOf('find:')===0)
			{
				fn = 'find';
				str = str.substr(5);
			} else if (fn!=='find')
				return;
			
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
			return new ide.Item({ title: val.title, icon: val.icon });
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
			return new ide.FileListEditor({
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

	commands: {

		browse: function()
		{
			ide.open('.');
		}

	},

	edit: function(options)
	{
		var file=options.file, files, path;

		if (file.attributes.directory)
		{
			files = file.content.map(function(f) {
				return new ide.Item({
					title: f.filename, className: f.directory ? 'directory' : 'file'
				});
			});

			files.unshift(new ide.Item({ title: '..', className: 'directory' }));
			path = file.filename;

			return new ide.FileListEditor({
				file: file,
				children: files,
				title: path,
				prefix: path==='.' ? '' : (path + '/'),
				slot: options.slot
			});
		}
	}

}));
	
ide.ListEditor = ListEditor;
ide.FileListEditor = FileListEditor;

})(this.ide, this.cxl);
