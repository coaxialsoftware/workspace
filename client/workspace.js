
(function(ide, cxl, $, undefined) {
"use strict";

var
	FILE_REGEX = /(\w+):(.*)/
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

		layout: ide.Layout.Smart,

		load_editor: function(file)
		{
			var m = FILE_REGEX.exec(file) || [ null, null, file ];
			ide.open(m[2], { plugin: m[1] });
		},

		load_files: function()
		{
		var
			files = this.hash.data.f || this.hash.data.file
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

		/**
		 * Save workspace state in the URL Hash.
		 */
		save: function()
		{
			var hash = this.hash, files = [];

			this.each(function(child) {
				files.push(child.state());
			});

			if (files.length===1)
				files = files[0];
			else if (files.length===0)
				files = 0;

			if (hash.data.project)
			{
				hash.data.p = hash.data.project;
				delete hash.data.project;
			}

			delete hash.data.file;
			hash.set({ f: files });
		},

		/** Returns a slot(DIV) to place a new editor */
		slot: function()
		{
		var
			el = $('<DIV>'),
			slot = { el: el[0], $el: el }
		;
			this.$el.append(el);

			this.slots.push(slot);
			this.do_layout();

			return slot;
		},

		do_layout: function()
		{
			var layout = this.layout(this.el);

			this.slots.forEach(function(slot, i)
			{
				slot.$el.css(layout[i]);
				slot.index = i;

				if (slot.editor && slot.editor.resize)
					slot.editor.resize();
			});

			this.save();
		},

		/** Iterates through the editors */
		each: function(cb)
		{
		var
			i = 0,
			slots = this.slots.concat()
		;
			for (; i<slots.length; i++)
				if (slots[i].editor && cb(slots[i].editor, i)=== false)
					return;
		},

		close_all: function()
		{
			this.each(this.remove.bind(this));
		},

		add: function(item)
		{
			this.trigger('add_child', item);
			item.focus();

			this.save();

			return this;
		},

		remove: function(item, force)
		{
		var
			slot = item.slot,
			msg = item.close(force)
		;

			if (typeof(msg)==='string')
			{
				if (window.confirm(msg))
					item.close(true);
				else
					return this;
			}

			this.slots.splice(slot.index, 1);

			if (this.slots[0] && this.slots[0].editor)
				this.slots[0].editor.focus();
			else
				ide.editor = null;

			this.do_layout();
			this.trigger('remove_child', item);

			return this;
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
				msg = slots[i].editor && slots[i].editor.close();
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

	ide.plugins.register('workspace', {

		commands: {

			Next: function()
			{
				ide.workspace.next().focus();
			},

			N: 'Next'

		},

		shortcut: {
			"gt": function()
			{
				ide.workspace.next().focus();
			},

			"gT": function()
			{
				ide.workspace.previous().focus();
			},

			'alt->': function()
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

			'alt-<': function()
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
