
(function(ide, cxl) {
"use strict";

function globToRegex(glob) {
var
	// The regexp we are building, as a string.
	reStr = "",

	// If we are doing extended matching, this boolean is true when we are inside
	// a group (eg {*.html,*.js}), and false otherwise.
	inGroup = false,

	c, len = glob && glob.length, i=0
;
	if (!len)
		return /[\s\S]*/;

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

class ListEditorCursor extends ide.feature.CursorFeature {
	
	render()
	{
		this.editor.listenTo(this.editor.$content, 'click', this.$onListClick.bind(this));
	}
	
	$onListClick(ev)
	{
		var target = ev.target;
		
		while (target!==this.editor.el && !target.$item)
			target = target.parentNode;
		
		if (target.$item)
		{
			target.focus();
			// TODO see if we need to use another key for alt
			this.enter(ev.shiftKey, ev.altKey);
		}
	}
	
	get current()
	{
		return this.editor.children.find(function(i) {
			return i.el.matches(':focus') && i.el.style.display!=='none';
		});
	}
	
	_findFirst()
	{
		return this.editor.children.find(function(i) {
			return i.el.style.display!=='none';
		});
	}
	
	_findLast()
	{
		var l = this.editor.children.length;
		
		while (l--)
			if (this.editor.children[l].el.style.display!=='none')
				return this.editor.children[l];
	}

	goForward()
	{
		this.goDown();
	}

	goBackwards()
	{
		this.goUp();
	}

	goDown(dir)
	{
		var i = this.current;

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
	}

	goUp()
	{
		this.goDown('previousSibling');
	}

	goStart()
	{
		var c = this._findFirst();

		if (c)
			c.el.focus();
	}

	goEnd()
	{
		var c = this._findLast();

		if (c)
			c.el.focus();
	}
	
	enter(shift, mod)
	{
		var c = this.current;
		
		if (c && c.enter)
			c.enter(shift, mod);

		if (!shift)
			ide.workspace.remove(this.editor);
	}

}

class ListSearchFeature extends ide.feature.SearchFeature {

	constructor(editor)
	{
		super(editor);
		this.editor = editor;
		editor.search = this.search.bind(this);
	}
	
	_findTest(regex, file)
	{
		return regex.test(file.title);
	}
	
	search(regex)
	{
	var
		children = this.editor.children,
		i=0, files = children,
		childrenEl = this.editor.$list.children, clear=!regex
	;
		for (; i<files.length; i++)
			childrenEl[i].style.display =
				(clear || this._findTest(regex, files[i])) ?
					'block' : 'none';
	}

}

// TODO see if we need to scroll by row
class ListScrollFeature extends ide.feature.ScrollFeature {

	render()
	{
		this.editor.listenTo(this.editor.$content, 'wheel', this.onWheel.bind(this));
	}

	get top()
	{
		return this.editor.$content.scrollTop;
	}

	get left()
	{
		return this.editor.$content.scrollLeft;
	}

	set(x, y)
	{
		if (x!==undefined && x!==null)
			this.editor.$content.scrollLeft = x;

		if (y!==undefined)
			this.editor.$content.scrollTop = y;
	}

	onWheel(ev)
	{
		var dY = ev.deltaY;
		this.set(null, this.top+dY);
		ev.preventDefault();
	}
}

class ListEditor extends ide.Editor {
	
	render(p)
	{
		super.render(p);
		this.el.classList.add('list');
		this.$list = document.createElement('ide-editor-list');
		this.$footer = document.createElement('ide-editor-footer');
		
		this.$content.appendChild(this.$list);
		this.$content.appendChild(this.$footer);

		this.children = p.children ? this._addElements(p.children, 0) : [];
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
		var i = this.current;
		
		if (i)
			i.el.focus();

		super.focus();
	}

}
	
ListEditor.features(ListEditorCursor, ListSearchFeature, ListScrollFeature);

class FileItem extends ide.Item {

	enter(shift, mod)
	{
	var
		item = this,
		title = item.value || item.title,
		options = {
			file: (this.prefix ? this.prefix+'/' : '') + title,
			focus: !shift
		}
	;
		if (item.line)
			options.line = item.line;

		if (mod)
			options.target = '_blank';

		ide.open(options);
	}

}

class FileListEditor extends ListEditor { }

FileListEditor.features(ide.feature.FileHashFeature, ide.feature.FileFeature);
	
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

	commands: { /** @lends ide.commands */

		/**
		 * Finds file by mask and displays all matches, if only one found
		 * it will automatically open it. If not mask is specified it will use
		 * the token under the active editor.
		 */
		find: function(mask)
		{
		var
			token = ide.editor && ide.editor.token,
			files = this.find(mask).map(function(val) {
				return new FileItem({ title: val.title, icon: val.icon });
			})
		;
			mask = mask || (token && getMask(token)) || '';
			
			if (!files)
				return ide.warn('[find] No files found in project.');

			if (files.length===1)
				ide.open({
					file: new ide.File(files[0].title)
				});
			else if (files.length===0)
				ide.notify('No files found that match "' + mask + '"');
			else
				return new ide.ListEditor({
					title: 'find ' + mask,
					command: 'find', args: mask,
					children: files,
					plugin: this
				});
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

	open: function(options)
	{
		var file=options.file, files, path, prefix;

		if (file && file.attributes.directory)
		{
			path = file.filename;
			prefix = path==='.' ? '' : (path + '/');

			files = file.content.map(function(f) {
				return new FileItem({
					title: f.filename,
					prefix: prefix,
					className: f.directory ? 'directory' : 'file'
				});
			});

			files.unshift(new FileItem(
				{ title: '..', className: 'directory', prefix: prefix }
			));

			return new ide.FileListEditor({
				file: file,
				children: files,
				title: path,
				slot: options.slot,
				plugin: this
			});
		}
	}

}));
	
ide.ListEditor = ListEditor;
ide.FileListEditor = FileListEditor;

})(this.ide, this.cxl);
