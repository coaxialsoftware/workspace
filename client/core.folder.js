
((ide, cxl)=>{
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
		token.value.substr(1, token.value.length-2) : token.value;
}

class CollapsibleItem extends ide.Item {

	toggle(ev, val)
	{
		if (ev) ev.stopPropagation();
		this.collapsed = val===undefined ? !this.collapsed : val;
		this.collapseEl.className = this.collapsed ? 'expand' : 'collapse';
	}

	$renderElements(obj)
	{
		super.$renderElements(obj);

		this.collapseEl = document.createElement('ide-icon');
		this.toggle(null, obj.collapsed);
		this.onClickRemove = new cxl.EventListener(
			this.collapseEl, 'click', this.toggle.bind(this));
	}

	$appendChildren()
	{
		this.el.appendChild(this.collapseEl);
		super.$appendChildren();
	}

	destroy()
	{
		super.destroy();
		this.onClickRemove.unsubscribe();
	}

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
			this.enter(ev.shiftKey, ev.ctrlKey);
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
	}

}

class ListSearchFeature extends ide.feature.SearchFeature {

	search(regex)
	{
	var
		children = this.editor.children,
		i=0, files = children,
		childrenEl = this.editor.$list.children, clear=!regex
	;
		for (; i<files.length; i++)
			childrenEl[i].style.display =
				(clear || files[i].matches(regex)) ?
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
		this.ItemClass = p.itemClass || ide.Item;

		this.children = p.children ? this._addElements(p.children, 0) : [];

		this.listenTo(this.el, 'focus', () => {
			if (!this.cursor.current)
				this.cursor.goStart();
		});
	}

	_addElements(items)
	{
		return items.map(function(item) {
			if (!(item instanceof ide.Item))
				item = new this.ItemClass(item);

			this.$list.appendChild(item.render());
			item.el.$item = item;
			return item;

		}, this);
	}

	reset()
	{
		this.children.forEach(c => c.destroy());
		this.children = [];
		this.$list.innerHTML = '';
	}

	add(items)
	{
		items = this._addElements(items);
		this.children = this.children.concat(items);
	}

}

ListEditor.features(ListEditorCursor, ListSearchFeature, ListScrollFeature);

class FileListEditor extends ListEditor { }

class DirectoryFeature extends ide.feature.FileFeature {

	parse()
	{
	var
		file = this.$file,
		path = file.name,
		prefix = path==='.' ? '' : path,
		open = options => this.replace(options.file),
		files
	;
		function getItem(f)
		{
			return new ide.FileItem({
				title: f.filename,
				mime: f.mime,
				prefix: prefix,
				className: f.directory ? 'directory' : 'file',
				open: f.mime==='text/directory' ? open : null
			});
		}

		files = file.content.sort(function(A, B) {
			return (A.mime==='text/directory' ? -2 : 0) + (B.mime==='text/directory' ? 2 : 0) +
				(A.filename.toLowerCase() < B.filename.toLowerCase() ? -1 : 1);
		}).map(f => getItem(f));

		if (file.path!=='.')
			files.unshift(getItem({ filename: '..', mime: 'text/directory' }));

		if (this.editor.children.length)
			this.editor.reset();

		this.editor.header.title = path;
		this.editor.add(files);
	}

}

FileListEditor.features(ide.feature.FileHashFeature, DirectoryFeature);

var worker = new ide.Worker({

	setFiles: function(files)
	{
		this.files = files;
	},

	getMask: getMask,

	canAssist: function(data)
	{
		var token = data.features.token;
		return token && (token.type===null || token.type==='string' ||
			token.type==='string property');
	},

	assist: function(data)
	{
	var
		token = data.features.token,
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

ide.plugins.register('folder', new ide.Plugin({

	core: true,

	start()
	{
		this.listenTo('project.load', this.onProject);
		this.listenTo('assist', this.onAssistInline);
		this.onProject(ide.project);
	},

	onProject(p)
	{
		worker.post('setFiles', p.attributes.files);
	},

	onAssistInline(request)
	{
	var
		token = request.features.token,
		str, ch, files
	;
		if (!token)
			return;

		str = token.cursorValue;

		if (token.type==='file')
		{
			files = this.find(str);
		} else if (token.type==='file-fuzzy')
		{
			files = this.find(str, true);
		} else if (token.type==='string')
		{
			ch = str[0];
			str = str.substr(1);
			files = this.find(str, false, ch);
		}

		if (files && files.length)
			request.respondInline(files);
	},

	getFuzzyRegex(mask)
	{
		var regex;

		if (typeof(mask)!=='string')
			return mask;

		try {
			regex = new RegExp(mask.split('').join('.*?'));
		} catch(e) {
			regex = mask;
		}

		return regex;
	},

	find(mask, fuzzy, enclose)
	{
	var
		regex = fuzzy ? this.getFuzzyRegex(mask) : globToRegex(mask),
		files = ide.project.get('files'),
		match
	;
		if (files)
		{
			return files.filter(function(val) {
				match = regex.exec(val.filename);

				if (match)
				{
					val.hint.matchStart = match.index;
					val.hint.matchEnd = match.index + match[0].length;

					if (enclose)
					{
						val.hint.matchStart += enclose.length;
						val.hint.matchEnd += enclose.length;
					}
				}

				return match;
			}).map(function(val) {
				// TODO optimize
				return new ide.FileItem({
					title: enclose ? enclose + val.filename + enclose : val.filename,
					icon: val.icon,
					matchStart: val.hint.matchStart,
					matchEnd: val.hint.matchEnd
				});
			});
		}
	},

	commands: { /** @lends ide.commands */

		/**
		 * Finds file by mask and displays all matches, if only one found
		 * it will automatically open it. If not mask is specified it will use
		 * the token under the active editor.
		 */
		find: {
			fn: function(mask)
			{
			var
				token = ide.editor && ide.editor.token && ide.editor.token.current,
				files
			;
				mask = mask || (token && getMask(token)) || '';
				files = this.find(mask).map(function(val) {
					return new ide.FileItem({ title: val.title, icon: val.icon });
				});

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
			},
			args: [ 'file-fuzzy' ]
		}

	},

	open: function(options)
	{
		var file=options.file;

		if (file && file.mime==='text/directory')
		{
			return new ide.FileListEditor({
				file: file
			});
		}
	}

}));

ide.ListEditor = ListEditor;
ide.FileListEditor = FileListEditor;
ide.CollapsibleItem = CollapsibleItem;

})(this.ide, this.cxl);
