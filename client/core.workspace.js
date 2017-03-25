
(function(ide, cxl) {
"use strict";

var
	FILE_REGEX = /^(?:([\w\-]+)(?:\.(\w+))?:)?(.*)$/
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

		ide.workspace.slots.forEach(function(child) {
			if (child.editor)
				files.push(child.editor.hash.get());
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
	var
		m = FILE_REGEX.exec(file),
		filename = !m[2] && m[3] && new ide.File(decodeURIComponent(m[3]))
	;
		if (filename)
			ide.open({
				file: filename, 
				plugin: m[1] && ide.plugins.get(m[1])
			});
		else
			ide.run(m[2], [ m[3] ]);
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

	setEditor(editor)
	{
		this.editor = editor;
		// TODO ?
		editor.slot = this;
		ide.workspace.el.appendChild(editor.el);
		ide.workspace.update();
		ide.plugins.trigger('workspace.add', editor);
	}

	setPosition(layout)
	{
		if (!this.editor)
			return;
		
		var s = this.editor.el.style;
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
		this.slots = [];
		this.layout = ide.Layout.Smart;
		this.update = cxl.debounce(this._update.bind(this));
		window.addEventListener('resize', this.update);
	}

	/** Returns a slot(DIV) to place a new editor */
	slot()
	{
		var slot = new Slot();
		this.slots.push(slot);
		ide.workspace.update();
		return slot;
	}

	removeSlot(slot)
	{
	var
		slots = this.slots,
		i = slots.indexOf(slot)
	;
		slots.splice(i, 1);

		if (slots[0] && slots[0].editor)
			slots[0].editor.focus.set();
		else
			ide.editor = null;

		this.update();
	}
	
	doRemove(editor)
	{
		this.el.removeChild(editor.el);
		this.removeSlot(editor.slot);
		ide.plugins.trigger('workspace.remove', this.editor);
	}
	
	// TODO does it make sense to have this here?
	remove(editor)
	{
		var msg = editor.quit();
		
		if (msg && window.confirm(msg))
			editor.quit(true);
		
		this.doRemove(editor);
	}
	
	_update()
	{
		var layout = this.layout(this.slots);

		ide.workspace.slots.forEach(function(slot, i)
		{
			slot.setPosition(layout[i]);
		});
		
		ide.hash.save();
		ide.plugins.trigger('workspace.resize');
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
	*/

	/** Find editor by id. */
	find(id)
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
	}

	/** Returns next editor */
	next()
	{
	var
		i = this.slots.indexOf(ide.editor.slot),
		next = this.slots[i+1] || this.slots[0]
	;
		return next && next.editor;
	}

	previous()
	{
	var
		i = this.slots.indexOf(ide.editor.slot),
		next = this.slots[i-1] || this.slots[this.editors.length-1]
	;
		return next && next.editor;
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

		wq: function()
		{
			// TODO use one run.
			ide.run('w').run('q');
		},

		'workspace.next': function()
		{
			ide.workspace.next().focus.set();
		},

		'workspace.previous': function()
		{
			ide.workspace.previous().focus.set();
		},

		'workspace.swapNext': function()
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

		'workspace.swapPrevious': function()
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
					ide.open({ file: new ide.File(arguments[i]) });
			else
				ide.open({});
		},

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
				ide.workspace.remove(ide.editor);
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
	var i=0, slots=ide.workspace.slots, msg;

	for (; i<slots.length; i++)
	{
		msg = slots[i].editor.quit();
		
		if (typeof(msg)==='string')
		{
			ev.returnValue = msg;
			return msg;
		}
	}
});

})(this.ide, this.cxl);
