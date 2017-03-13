
(function(ide, cxl) {
"use strict";

var
	FILE_REGEX = /^([\w\-]+)(?:\.(\w+))?:(.*)$/
;
	
class Hash {
	
	constructor()
	{
		this._onHashChange = this.onHashChange.bind(this);
		this.decode();
	}

	clean(hash)
	{
		for (var i in hash)
			if (!hash[i])
				delete hash[i];

		return hash;
	}

	decode()
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
			this.data = result || {};
		}
	}

	encode(obj)
	{
	var
		data = this.clean(cxl.extend({}, this.data, obj)),
		hash = JSON.stringify(data)
	;
		return hash.slice(1, hash.length-1);
	}

	set(obj)
	{
		cxl.extend(this.data, obj);
		window.location.hash = this.encode();
	}
	
	/**
	 * Save workspace state in the URL Hash.
	 */
	save()
	{
		var hash = this, files = [];

		ide.workspace.editors.forEach(function(child) {
			files.push(child.getHash());
		});

		hash.set({ f: files });

		return this;
	}
	
	onHashChange()
	{
		var hash = window.location.hash;
		window.removeEventListener('hashchange', this._onHashChange, false);

		this.ignore_hash = true;
		this.close_all();
		window.location.hash = hash;

		if (ide.project.get('path') !== this.hash.data.p)
			this.loadProject(this.loadFiles.bind(this));
		else
		{
			this.data = this.decode();
			this.loadFiles();
		}
	}
	
	loadEditor(file)
	{
		var m = FILE_REGEX.exec(file);
		
		ide.open({
			file: m[3] && new ide.File(decodeURIComponent(m[3])),
			command: m[2],
			plugin: m[1] && ide.plugins.get(m[1])
		});
	}
	
	loadFiles()
	{
		var files = this.data.f;
		
		if (!files)
			return;

		if (files instanceof Array)
			files.forEach(this.loadEditor.bind(this));
		else
			this.loadEditor(files);
	}
	
}

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

class Slot {

	constructor()
	{
		this.el = document.createElement('DIV');
	}

	remove()
	{
		ide.workspace.el.removeChild(this.el);
	}

	setPosition(layout)
	{
		var s = this.el.style;
		s.top = layout.top;
		s.left = layout.left;
		s.width = layout.width;
		s.height = layout.height;
	}
}
	
ide.Workspace = class Workspace {
	
	constructor()
	{
		this.el = document.getElementById('workspace');
		this.editors = [];
		this.layout = ide.Layout.Smart;
		window.addEventListener('resize', cxl.debounce(this.update.bind(this), 250));
	}

	/** Returns a slot(DIV) to place a new editor */
	slot()
	{
		var slot = new Slot();
		this.el.appendChild(slot.el);
		return slot;
	}
	
	update()
	{
		var layout = this.layout(this.editors);

		ide.workspace.editors.forEach(function(editor, i)
		{
			editor.slot.setPosition(layout[i]);
		}, this);
		
		ide.hash.save();
	}
	
	swap(e1, e2)
	{
		var tmp = this.editors[e1];
		this.editors[e1] = this.editors[e2];
		this.editors[e2] = tmp;
		this.update();
	}

	/** Iterates through open editors. Return false to stop. */
	/*each(cb)
	{
	var
		i = 0,
		slots = this.slots
	;
		for (; i<slots.length; i++)
			if (slots[i].editor && cb.call(this, slots[i].editor, i)=== false)
				return;
	}

	closeAll()
	{
		this.each(function(item) {
			setTimeout(this.remove.bind(this, item));
		});
	}

	/** Find editor by id. */
	/*find(id)
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
	}*/

	add(item, focus)
	{
		this.editors.push(item);
		
		ide.plugins.trigger('workspace.add', item);

		if (focus!==false)
			item.focus();
		
		this.update();
		ide.plugins.trigger('workspace.resize');
		
		ide.hash.save();
	}

	remove(item)
	{
		var i = this.editors.indexOf(item);
		item.slot.remove();
		
		this.editors.splice(i, 1);
		
		if (this.editors[0])
			this.editors[0].focus();
		else
			ide.editor = null;

		ide.plugins.trigger('workspace.remove', item);
		this.update();
	}

	/** Returns next editor */
	next()
	{
	var
		i = this.editors.indexOf(ide.editor),
		next = this.editors[i+1] || this.editors[0]
	;
		return next;
	}

	previous()
	{
	var
		i = this.editors.indexOf(ide.editor),
		next = this.editors[i-1] || this.editors[this.editors.length-1]
	;
		return next;
	}

};

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
					newfile.content = JSON.stringify(file.diff(), null, 2);
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
				file = file || ide.editor.file.filename;

				cxl.ajax.get('/file?p=' + ide.project.id + '&n=' + file)
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
			var editor = ide.editor, file;
			
			if (!editor)
				return ide.Pass;

			if (filename)
				file = ide.fileManager.getFile(filename);
			
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
			content = file.content;
			file.content = content.replace(from, to);
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
			{
				var msg = ide.editor.quit();

				if (msg && window.confirm(msg))
					ide.editor.quit(true);
			}
			else
				window.close();
		},

		qa: function()
		{
			ide.workspace.closeAll();
		},

		/// Quit always, without writing.
		"q!": function()
		{
			if (ide.editor)
				ide.editor.quit(true);
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
	
ide.Hash = Hash;
	
window.addEventListener('beforeunload', function(ev) {
	var i=0, slots=ide.workspace.editors, msg;

	for (; i<slots.length; i++)
	{
		msg = slots[i].quit();
		
		if (typeof(msg)==='string')
		{
			ev.returnValue = msg;
			return msg;
		}
	}
});

})(this.ide, this.cxl);
