
(function(ide, Backbone, $, undefined) {
"use strict";

	ide.Bar = Backbone.View.extend({

		/**
		 * When a key is pressed and its found here the
		 * function will be called. Use keys function to
		 * assign more bindings.
		 *
		 * @private
		 */
		_keys: null,

		/**
		 * Previous Value
		 */
		_value: '',

		/** @abstract */
		cancel: function() { },

		initialize: function Bar()
		{
			this._keys = {
			// TODO Use Key constants
			27: function() { this.cancel(); this.hide(); },
			13: function() { this.run(); this.hide(); },
			8: function() {
				if (this._value==='')
					this.hide();
				},
			9: function() {
			var
				el = this.el,
				i = el.value.lastIndexOf(' ', el.selectionStart)+1,
				text = ''
			;
				text = el.value.substr(i, el.selectionStart-i);

				if (this.on_complete)
					this.on_complete(text, i, el.selectionStart);
			},
			219: function(ev) {
				if (ev.ctrlKey)
				{
					this.cancel(); this.hide();
				}
			}
			};

			this.$el.on('keyup', this.on_key.bind(this));
			this.$el.on('keydown', this.on_keydown.bind(this));
			this.$el.on('keypress', this.on_keypress.bind(this));
			this.$el.on('blur', this.on_blur.bind(this));
		},

		on_blur: function()
		{
			this.hide();
		},
		
		on_keypress: function(ev)
		{
			ev.stopPropagation();
		},

		on_keydown: function(ev)
		{
			if (ev.keyCode===9)
				ev.preventDefault();
			ev.stopPropagation();
		},

		on_key: function(ev)
		{
		var
			fn = this._keys[ev.keyCode]
		;
			if (this.hidden)
				return;

			if (fn)
				fn.apply(this, [ ev ]);

			if (this.el.value!==this._value)
			{
				this._lastSearch = null;
				if (this.on_change)
					this.on_change(this.el.value);
			}

			this._value = this.el.value;
			ev.stopPropagation();
			return false;
		},

		keys: function(k)
		{
			$.extend(this._keys, k);
		},

		show: function()
		{
			this.$el.val('').css('display', 'block');
			this.hidden = false;
			this.focus();
		},

		focus: function()
		{
			this.el.focus();
		},

		hide: function()
		{
			this.$el.hide();

			this.hidden = true;
			if (ide.editor)
				ide.editor.focus();
			return false;
		},

		start: function()
		{
			document.body.appendChild(this.el);
		}

	});

	ide.Bar.Command = ide.Bar.extend({

		el: $('<input id="command" />'),
		
		actions: {
			ex: function() { this.show(); }
		},
		
		shortcuts: {
			vim: { "':'": 'ex' },
			default: { 'alt-enter': 'ex' }
		},

		history: [],
		history_max: 50,
		history_index: 0,

		history_up: function(ev)
		{
			var val = this.history[this.history_index++];

			if (val)
				this.el.value = val;

			ev.preventDefault();
		},

		history_add: function(val)
		{
			this.history_index = 0;
			this.history.unshift(val);
		},

		history_down: function(ev)
		{
			if (this.history_index>0)
				this.history_index -= 2;

			this.history_up(ev);
		},

		ready: function()
		{
			this._keys[38] = this.history_up.bind(this);
			this._keys[40] = this.history_down.bind(this);
		},

		run: function()
		{
		var
			val = this.el.value
		;
			if (val==='')
				return;

			this.history_add(val);
			ide.cmd(val);
		},

		on_complete: function(s, start, end)
		{
		var
			val = this.el.value,
			files = ide.project.files_text,
			match
		;
			if (files && !this._lastSearch)
			{
				this._lastSearch = files.match(
					new RegExp('^' + s + '[^/\n]*$', 'mg')
				);
				this._lastSearchStart = start;
				this._lastSearchIndex = 0;
			} else if (this._lastSearchIndex===this._lastSearch.length)
				this._lastSearchIndex = 0;

			if (!this._lastSearch)
				return;

			match = this._lastSearch[this._lastSearchIndex++];
			this._value = this.el.value = val.slice(0, start) + match + val.slice(end);
		}

	});

	ide.Bar.Search = ide.Bar.extend({

		el: $('<input id="search" />'),
		
		actions: {
			find: function() { this.show(); }
		},
		
		shortcuts: {
			vim: { '/': 'find' }
		},

		run: function()
		{
		},

		cancel: function()
		{
			if (ide.editor && ide.editor.find)
				ide.editor.find();
		},

		on_change: function(val)
		{
		var
			regex
		;
			try { regex = new RegExp(val, 'm'); } catch(e) { regex = val; }

			if (ide.editor && ide.editor.find)
				ide.editor.find(regex);
		}

	});

	ide.plugins.register('search', new ide.Bar.Search());
	ide.plugins.register('command', new ide.Bar.Command());

})(this.ide, this.Backbone, this.jQuery);
