
(function(ide, cxl, $, undefined) {
"use strict";

var
	FILE_REGEX = /^(?:([\w\.\-]+):)?(?:([^:]+):)?([^:]*)$/
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

	Smart: function(el)
	{
	var
		i=0,
		child = el.children,
		l = child.length,
		result, w
	;
		switch (l)
		{
		case 0: return;
		case 1: return [{ left: 0, top: 0, height: '100%', width: '100%' }];
		case 2: return [
				{ left: 0, top: 0, height: '100%', width: '50%' },
				{ left: '50%', top: 0, height: '100%', width: '50%' }
			];
		}

		w = Math.floor(100 / (Math.ceil(l/2)));
		result = [];

		if (l % 2)
		{
			i = w;
			result.push({ left: 0, top: 0, height: '100%', width: w + '%'});
		}

		for (; i<100; i+=w)
			result.push(
				{ left: i+'%', top: 0, width: w + '%', height: '50%' },
				{ left: i+'%', top: '50%', width: w + '%', height: '50%' }
			);

		return result;
	}

};

ide.Workspace = cxl.View.extend({ /** @lends ide.Workspace# */

	el: '#workspace',

	slots: null,
	editors: null,

	layout: ide.Layout.Smart,

	load_editor: function(file)
	{
	var
		m = FILE_REGEX.exec(file),
		op = {
			file: m[2] ? m[3] || null : m[3],
			plugin: m[1],
			params: m[2]
		}
	;
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
		this.load_files();
	},
	
	state: function(editor)
	{
		return (editor.plugin ? editor.plugin.name + ':' : '') +
			(editor.params ? editor.params + ':' : '') +
			(editor.file && editor.file.get('filename') || '');
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

		if (files.length===1)
			files = files[0];
		else if (files.length===0)
			files = 0;

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
		var layout = this.layout(this.el);

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

	add: function(item)
	{
		item.slot.editor = item;
		item.focus();

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

		if (this.slots[0])
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

		project.fetch({ success: cb });
	},

	initialize: function()
	{
		this.load_project(this.load_workspace.bind(this));
		this._on_hashchange = this.on_hashchange.bind(this);

		window.addEventListener('beforeunload', this.on_beforeunload.bind(this));
	}

});

ide.plugins.registerCommands({
	
	editorCommands: {
		
		ascii: function()
		{
		var
			char = this.getChar(),
			code = char.charCodeAt(0)
		;
			ide.notify(char + ': ' + code + ' 0x' + code.toString(16) + ' 0' + code.toString(8));
		}
		
	},

	commands: {
		
		help: function(topic)
		{
			window.open('/docs/index.html#' + (topic || ''));
		},

		/// Quit always, without writing.
		"q!": function()
		{
			if (ide.editor)
				ide.workspace.remove(ide.editor, true);
		},
		
		/**
		 * Edits file with registered plugins.
		 * @param {string} ... Files to open.
		 */
		edit: function() {
			if (arguments.length)
				for (var i=0; i<arguments.length; i++)
					ide.open(arguments[i]);
			else
				ide.open('');
		},
		
		f: 'file',
		
		file: function()
		{
			ide.notify((ide.editor && ide.editor.file) ?
				ide.editor.file.id || '[No Name]' :
				'No files open.');
		},
		
		tabe: function(name)
		{
			ide.open_tab(name, '_blank');
		},
		
		close: function()
		{
			window.close();
		},
		
		w: 'write',
		
		wq: function()
		{
			// TODO use one run.
			ide.run('w').run('q');
		},
		
		/// Quit Vim. This fails when changes have been made.
		q: function()
		{
			if (ide.editor)
				ide.workspace.remove(ide.editor);
			else
				window.close();
		},

		qa: function()
		{
			ide.workspace.close_all();
		},
		
		nextEditor: function()
		{
			ide.workspace.next().focus();
		},

		prevEditor: function()
		{
			ide.workspace.previous().focus();
		},

		moveNext: function()
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

		movePrev: function()
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
		
	}

});

})(this.ide, this.cxl, this.jQuery);
