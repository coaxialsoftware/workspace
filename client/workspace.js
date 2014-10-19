
(function(ide, Backbone, $, _, undefined) {
"use strict";

	function Hash()
	{
	var
		hash = this.decode()
	;
		this.data = hash;
	}

	_.extend(Hash.prototype, {

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
			data = this.clean($.extend({}, this.data, obj)),
			hash = JSON.stringify(data)
		;

			return hash.slice(1, hash.length-1);
		},

		set: function(obj)
		{
			$.extend(this.data,obj);
			window.location.hash = this.encode();
		}
	});

	ide.Workspace = Backbone.View.extend({ /** @lends ide.Workspace# */

		el: '#workspace',

		children: null,

		layout: function(el)
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
		},

		do_layout: function()
		{
		var
			me = this,
			child = me.children,
			layout,
			i = 0
		;
			if (!me.layout)
				return;

			layout = me.layout(me.el);

			for (; i<child.length; i++)
			{
				child[i].$el.css(layout[i]);
				if (child[i].resize) child[i].resize();
			}
		},

		load: function()
		{
			var files = this.hash.data.f || this.hash.data.file;

			ide.plugins.start();
			$('#mask').hide();

			if (!files)
				return;

			if (files instanceof Array)
				files.forEach(ide.open, ide);
			else
				ide.open(files);
		},

		/**
		 * Save workspace state in the URL Hash.
		 */
		save: function()
		{
			var hash = this.hash, files = [];

			this.children.forEach(function(child) {
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

		close_all: function()
		{
			this.children.concat().forEach(this.remove.bind(this));
		},

		add: function(item)
		{
			this.children.push(item);
			this.$el.append(item.el);
			this.do_layout();
			this.trigger('add_child', item);
			item.focus();

			this.save();

			return this;
		},

		remove: function(item, force)
		{
			var msg = item.close(force);
			if (typeof(msg)==='string' && window.confirm(msg))
				return;

			this.children.splice(this.children.indexOf(item), 1);

			if (this.children[0])
				this.children[0].focus();
			else
				ide.editor = null;

			this.do_layout();
			this.save();

			this.trigger('remove_child', item);

			return this;
		},

		/** Moves to next editor */
		next: function()
		{
		var
			i = this.children.indexOf(ide.editor),
			next = this.children[i+1] || this.children[0]
		;
			return next;
		},

		on_beforeunload: function()
		{
			var i=0, children=this.children, msg;

			for (; i<children.length; i++)
			{
				msg = children[i].close();
				if (typeof(msg)==='string')
					return msg;
			}
		},

		swap: function(e1, e2)
		{
			var tmp = this.children[e1];
			this.children[e1] = this.children[e2];
			this.children[e2] = tmp;

			this.do_layout();
		},

		initialize: function Workspace()
		{
		var
			hash = this.hash = new Hash(),
			project = this.project = ide.project = new ide.Project({
				path: hash.data.p || hash.data.project
			})
		;
			this.children = [];

			project.fetch({ success: this.load.bind(this) });

			window.addEventListener('beforeunload', this.on_beforeunload.bind(this));
		}

	});

	ide.plugins.register('workspace', {

		shortcut: {
			"gt": function()
			{
				ide.workspace.next().focus();
			},

			'alt->': function()
			{
			var
				l = ide.workspace.children.length, i
			;
				if (l>1)
				{
					i = ide.workspace.children.indexOf(ide.editor);
					ide.workspace.swap(i, (i === l-1) ? 0 : i+1);
				}
			},

			'alt-<': function()
			{
			var
				l = ide.workspace.children.length, i
			;
				if (l>1)
				{
					i = ide.workspace.children.indexOf(ide.editor);
					ide.workspace.swap(i, (i === 0) ? l-1 : i-1);
				}
			}
		}

	});

})(this.ide, this.Backbone, this.jQuery, this._);