
(function(ide, cxl, $, _, undefined) {
"use strict";

var
	FILE_REGEX = /^(?:([\w\.\-]+):)?(.*)$/
;

function Hash()
{
var
	hash = this.decode()
;
	this.data = hash;
}

cxl.extend(Hash.prototype, {

	data: null,

	clean: function(hash)
	{
		for (var i in hash)
			if (!hash[i])
				delete hash[i];

		return hash;
	},

	decode: function()
	{
	var
		h = '{'+window.location.hash.substr(1)+'}',
		result
	;
		try {
			result = (h && this.clean(JSON.parse(h)));
		} catch (e) {
			window.location.hash = '';
		} finally {
			return result || {};
		}
	},

	encode: function(obj)
	{
	var
		data = this.clean(cxl.extend({}, this.data, obj)),
		hash = JSON.stringify(data)
	;

		return hash.slice(1, hash.length-1);
	},

	set: function(obj)
	{
		cxl.extend(this.data, obj);
		window.location.hash = this.encode();
	}
});

/**
 * Layout Algorithms.
 * @enum
 */
ide.Layout = {
	
	// Layout Breakpoints
	SMALL: 544,
	
	Vertical: function(child)
	{
	var
		h = (100 / child.length)
	;
		return child.map(function(c, i) {
			return { left: 0, top: (i*h)+'%', height: h+'%', width: '100%' };
		});
	},

	Smart: function(child)
	{
	var
		i=0,
		l = child.length,
		result, w, ws
	;
		if (ide.workspace.el.clientWidth < ide.Layout.SMALL)
			return ide.Layout.Vertical(child);
		
		switch (l)
		{
		case 0: return;
		case 1: return [{ left: 0, top: 0, height: '100%', width: '100%' }];
		case 2: return [
				{ left: 0, top: 0, height: '100%', width: '50%' },
				{ left: '50%', top: 0, height: '100%', width: '50%' }
			];
		}

		w = (100 / Math.ceil(l/2));
		ws = w.toFixed(2);
		result = [];

		if (l % 2)
		{
			i = w;
			result.push({ left: 0, top: 0, height: '100%', width: ws + '%'});
		}

		for (; i<100; i+=w)
			result.push(
				{ left: i+'%', top: 0, width: ws + '%', height: '50%' },
				{ left: i+'%', top: '50%', width: ws + '%', height: '50%' }
			);

		return result;
	}

};

ide.Workspace = cxl.View.extend({ /** @lends ide.Workspace# */

	el: '#workspace',

	slots: null,
	editors: null,

	layout: ide.Layout.Smart,

	showInfo: function()
	{
		var info = ide.editor && ide.editor.getInfo();

		window.document.title = info || 'workspace';

		if (!ide.assist.visible)
			ide.notify(info);
	},

	load_editor: function(file)
	{
	var
		m = FILE_REGEX.exec(file),
		op = {
			file: m[2],
			plugin: m[1]
		}
	;
		if (op.file)
			op.file = decodeURIComponent(op.file);

		ide.open(op);
	},

	load_files: function()
	{
	var
		files = this.hash.data.f
	;
		if (!files)
			return;

		if (files instanceof Array)
			files.forEach(this.load_editor.bind(this));
		else
			this.load_editor(files);
	},

	load_workspace: function()
	{
		ide.plugins.start();
		ide.keymap.start();
		this.load_files();
	},

	state: function(editor)
	{
	var
		file = (editor.file instanceof ide.File ?
			editor.file.get('filename') :
			editor.file) || '',
		plugin = editor.plugin && (typeof(editor.plugin)==='string' ?
			editor.plugin : editor.plugin.name)
	;
		return (plugin ? plugin + ':' : '') + encodeURIComponent(file);
	},

	/**
	 * Save workspace state in the URL Hash.
	 */
	save: function()
	{
		var hash = this.hash, files = [];

		this.each(function(child) {
			files.push(this.state(child));
		});

		hash.set({ f: files });

		return this;
	},

	/** Returns a slot(DIV) to place a new editor */
	slot: function()
	{
	var
		el = document.createElement('DIV'),
		slot = { el: el, $el: $(el) }
	;
		this.$el.append(el);
		this.slots.push(slot);

		return slot;
	},

	do_layout: function()
	{
		var layout = this.layout(this.slots);

		this.slots.forEach(function(slot, i)
		{
			slot.$el.css(layout[i]);
			slot.index = i;
		});

		ide.plugins.trigger('workspace.resize');
		return this.save();
	},

	/** Iterates through open editors. Return false to stop. */
	each: function(cb)
	{
	var
		i = 0,
		slots = this.slots
	;
		for (; i<slots.length; i++)
			if (slots[i].editor && cb.call(this, slots[i].editor, i)=== false)
				return;
	},

	close_all: function()
	{
		this.each(function(item) {
			setTimeout(this.remove.bind(this, item));
		});
	},

	/** Find editor by id. */
	find: function(id)
	{
	var
		slots = this.slots,
		l = slots.length,
		editor
	;
		while (l--)
		{
			editor = slots[l].editor;
			if (editor && editor.id===id)
				return editor;
		}
	},

	add: function(item)
	{
		item.slot.editor = item;
		ide.plugins.trigger('workspace.add', item);
		return this.do_layout();
	},

	remove: function(item, force)
	{
	var
		slot = item.slot,
		msg = item._close(force)
	;
		if (typeof(msg)==='string')
		{
			if (window.confirm(msg))
				item._close(true);
			else
				return this;
		}

		this.slots.splice(slot.index, 1);

		if (this.slots[0] && this.slots[0].editor)
			this.slots[0].editor.focus();
		else
			ide.editor = null;

		ide.plugins.trigger('workspace.remove', item);

		return this.do_layout();
	},

	/** Returns next editor */
	next: function()
	{
	var
		i = ide.editor.slot.index,
		next = this.slots[i+1] || this.slots[0]
	;
		return next.editor;
	},

	previous: function()
	{
	var
		i = ide.editor.slot.index,
		next = this.slots[i-1] || this.slots[this.slots.length-1]
	;
		return next.editor;
	},

	on_beforeunload: function(ev)
	{
		var i=0, slots=this.slots, msg;

		for (; i<slots.length; i++)
		{
			msg = slots[i].editor && slots[i].editor._close();
			if (typeof(msg)==='string')
			{
				ev.returnValue = msg;
				return msg;
			}
		}
	},

	swap: function(e1, e2)
	{
		var tmp = this.slots[e1];
		this.slots[e1] = this.slots[e2];
		this.slots[e2] = tmp;

		this.do_layout();
	},

	on_hashchange: function()
	{
		var hash = window.location.hash;
		window.removeEventListener('hashchange', this._on_hashchange, false);

		this.ignore_hash = true;
		this.close_all();
		window.location.hash = hash;

		if (ide.project.get('path') !== this.hash.data.p)
			this.load_project(this.load_files.bind(this));
		else
		{
			this.hash = new Hash();
			this.load_files();
		}
	},

	load_project: function(cb)
	{
	var
		hash = this.hash = new Hash(),
		project = this.project = ide.project = new ide.Project({
			path: hash.data.p || hash.data.project
		})
	;
		this.slots = [];
		this.editors = [];

		project.fetch({ success: cb });
	},

	initialize: function()
	{
		var showInfo = this.showInfo.bind(this);

		this.load_project(this.load_workspace.bind(this));
		this._on_hashchange = this.on_hashchange.bind(this);

		this.listenTo(window, 'beforeunload', this.on_beforeunload);
		this.listenTo(window, 'resize', _.debounce(this.do_layout.bind(this), 250));
		
		ide.plugins.on('editor.focus', showInfo);
		ide.plugins.on('file.write', showInfo);
	}

});

ide.plugins.registerCommands({

	editorCommands: {

		ascii: function()
		{
		var
			char = ide.editor.getChar(),
			code = char.charCodeAt(0)
		;
			ide.notify(char + ': ' + code + ' 0x' + code.toString(16) + ' 0' + code.toString(8));
		},

		f: 'file',

		/**
		 * File diff
		 */
		diff: function()
		{
		var
			file = ide.editor && ide.editor.file,
			diff = file && file.diff && file.diff(),
			newfile
		;
			if (!diff)
				return;

			newfile = new ide.File({
				filename: '',
				new: true,
				content: JSON.stringify(diff, null, 2)
			});

			ide.open({ file: newfile }).then(function(editor) {
				editor.listenTo(file, 'change:content', function() {
					newfile.set('content', JSON.stringify(file.diff(), null, 2));
				});
				editor.cmd('inputDisable');
			});
		},


		file: function()
		{
			ide.notify(ide.editor.file ?
				ide.editor.file.id || '[No Name]' :
				'No files open.');
		},

		read: function(file)
		{
			if (ide.editor.insert)
			{
				file = file || ide.editor.file.get('filename');

				$.get('/file?p=' + ide.project.id + '&n=' + file)
					.then(function(content) {
						if (content.new)
							ide.notify('File does not exist.');
						else
							ide.editor.insert(content.content.toString());
					}, function(err) {
						ide.error(err);
					});
			} else
				ide.error('Current editor does not support command.');
		},

		r: 'read',

		w: 'write',
		save: 'write',

		wq: function()
		{
			// TODO use one run.
			ide.run('w').run('q');
		},

		write: function(filename, force)
		{
			var editor = ide.editor, file=editor.file;

			if (!(file instanceof ide.File))
				return ide.Pass;

			if (filename)
			{
				if (file.get('filename'))
				{
					file = ide.fileManager.getFile(filename);
					editor.setFile(file);
				} else
					file.set('filename', filename);
			}

			if (!file.get('filename'))
				return ide.error('No file name.');

			if (!force && file.old)
				return ide.error('File contents have changed.');

			editor.write(file, force);
		},

		'w!': function(filename)
		{
			this.write(filename, true);
		},

		editorNext: function()
		{
			ide.workspace.next().focus();
		},

		editorPrevious: function()
		{
			ide.workspace.previous().focus();
		},

		editorMoveNext: function()
		{
		var
			l = ide.workspace.slots.length, i
		;
			if (l>1)
			{
				i = ide.workspace.slots.indexOf(ide.editor.slot);
				ide.workspace.swap(i, (i === l-1) ? 0 : i+1);
			}
		},

		editorMovePrevious: function()
		{
		var
			l = ide.workspace.slots.length, i
		;
			if (l>1)
			{
				i = ide.workspace.slots.indexOf(ide.editor.slot);
				ide.workspace.swap(i, (i === 0) ? l-1 : i-1);
			}

		}

	},

	fileFormatApply: function(from, to)
	{
	var
		file = ide.editor.file,
		content
	;
		if (file instanceof ide.File)
		{
			content = file.get('content');
			file.set('content', content.replace(from, to));
		}
	},

	commands: {

		help: function(topic)
		{
			var url = (ide.project.get('help.url') ||
				'/docs/index.html') + (topic ? '#' + topic : '');

			window.open(url);
		},

		e: 'edit',

		/**
		 * Edits file with registered plugins.
		 * @param {string} ... Files to open.
		 */
		edit: function() {
			if (arguments.length)
				for (var i=0; i<arguments.length; i++)
					ide.open(arguments[i]);
			else
				ide.open();
		},

		fileformat: [
			{ cmd: 'unix', fn: function() {
				this.fileFormatApply(/\r/g, "");
			}, editor: true },
			{ cmd: 'dos', fn: function() {
				this.fileFormatApply(/\n/g, "\r\n");
			}, editor: true }
		],

		tabe: function(name)
		{
			ide.openTab(name);
		},

		close: function()
		{
			window.close();
		},

		quit: 'q',
		'quitAll': 'qa',
		'quitForce': 'q!',

		/// Quit Vim. This fails when changes have been made.
		q: function()
		{
			if (ide.editor)
				ide.editor.quit();
			else
				window.close();
		},

		qa: function()
		{
			ide.workspace.close_all();
		},

		/// Quit always, without writing.
		"q!": function()
		{
			if (ide.editor)
				ide.workspace.remove(ide.editor, true);
		},

		version: function()
		{
			ide.notify({
				code: 'version',
				tags: ['workspace:' + ide.project.get('workspace.version')],
				title: ide.project.get('name') + ':' + ide.project.get('version')
			});
		}

	}

});

})(this.ide, this.cxl, this.jQuery, this._);
