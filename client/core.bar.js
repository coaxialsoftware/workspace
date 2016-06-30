
(function(ide, cxl, $, undefined) {
"use strict";

ide.Bar = cxl.View.extend({

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

	findWord: function(cb)
	{
	var
		el = this.el,
		text,
		i = el.selectionStart
	;
		do {
			i = el.value.lastIndexOf(' ', i-1);
		} while (el.value[i-1]==='\\');

		i++;

		text = el.value.substr(i, el.selectionStart-i);

		cb.call(this, text, i, el.selectionStart);
	},

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
			if (this.on_complete)
				this.findWord(this.on_complete);
		},
		219: function(ev) {
			if (ev.ctrlKey)
			{
				this.cancel(); this.hide();
			}
		}
		};

		this.listenTo(this.el, 'keyup', this.on_keyup);
		this.listenTo(this.el, 'keydown', this.on_key);
		this.$el.on('keypress', this.on_keypress.bind(this));
		this.$el.on('blur', this.on_blur.bind(this));

		if (this.start)
			this.start();
	},

	on_blur: function(ev)
	{
		var rel = ev.relatedTarget, assist = ide.assist.inline.el;
		// Prevent assist window from hiding
		if (rel && (rel===assist || rel.parentNode===assist))
		{
			ev.preventDefault();
			this.el.focus();
		}
		else
			this.hide();
	},

	on_keyup: function(ev)
	{
		if (this.el.value!==this._value)
		{
			this._lastSearch = null;
			if (this.on_change)
				this.on_change(this.el.value);
		}

		this._value = this.el.value;

		if (ev)
			ev.stopPropagation();
	},

	on_keypress: function(ev)
	{
		ev.stopPropagation();
	},

	on_key: function(ev)
	{
	var
		fn = this._keys[ev.keyCode],
		result=false
	;
		if (this.hidden)
			return;

		// Manually call uiState handler...
		// TODO see if we can refactor this.
		if (ev.keyCode!==13 && ide.keymap.uiState)
		{
			result = ide.keymap.handle(ide.keyboard.getKeyId(ev), ide.keymap.uiState);
			if (result!==false)
				ev.preventDefault();
		}

		if (ev.keyCode===9 || ev.keyCode===13)
			ev.preventDefault();

		if (result===false && fn)
			fn.call(this, ev);

		ev.stopPropagation();
	},

	keys: function(k)
	{
		$.extend(this._keys, k);
	},

	show: function(val)
	{
		val = val || '';
		this.$el.val(val).css('display', 'block');
		if (val.length)
			this.el.setSelectionRange(val.length, val.length);
		this.hidden = false;
		this.focus();
	},

	focus: function()
	{
		this.el.focus();
	},

	insert: function(text)
	{
	var
		val = this.el.value,
		start = this.el.selectionStart
	;
		this.el.value = val.slice(0, start) + text + val.slice(start);
		this.on_keyup();
	},

	replaceRange: function(text, start, end)
	{
	var
		val = this.el.value
	;
		this.el.value = val.slice(0, start.ch) + text + val.slice(end.ch);
		this.on_keyup();
	},

	hide: function()
	{
		this.$el.hide();
		this.hidden = true;
		ide.assist.cancel();

		if (ide.editor)
			ide.editor.focus();

		ide.assist.inline.hide();

		return false;
	}

});

ide.Bar.Command = ide.Bar.extend({

	el: '#command',

	history: [],
	history_max: 50,
	history_index: 0,
	cloneEl: null,

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

	start: function()
	{
		this._keys[38] = this.history_up.bind(this);
		this._keys[40] = this.history_down.bind(this);

		this.cloneEl = window.document.createElement('SPAN');
		this.cloneEl.className = 'command-bar-width';
		document.body.appendChild(this.cloneEl);
	},

	run: function()
	{
	var
		val = this.el.value,
		cmd, result
	;
		if (val==='')
			return;

		this.history_add(val);

		try {
			cmd = ide.commandParser.parse(val);
		} catch(e) {
			return ide.error(e.message);
		}

		result = cmd ? ide.runParsedCommand(cmd) : ide.Pass;

		if (result===ide.Pass)
			ide.warn('Unknown Command: ' + val);
		else if (typeof(result)==='string' || result instanceof ide.Hint)
			ide.notify(result);
	},

	option: function()
	{

	},

	on_change: function()
	{
		this.findWord(function(s, start, end) {
			var cmd = ide.commandParser.parse(this.el.value, true);

			ide.plugins.trigger('token', this, this.token = {
				line: 0, start: start, ch: end, string: s,
				state: cmd[cmd.length-1]
			});
		});
	},

	/*
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
		} else if (this._lastSearch && this._lastSearchIndex===this._lastSearch.length)
			this._lastSearchIndex = 0;

		if (!this._lastSearch)
			return;

		match = this._lastSearch[this._lastSearchIndex++];
		this._value = this.el.value = val.slice(0, start) + text + val.slice(start));
		this.on_change();
	},
	*/

	getCursorCoordinates: function(cursor)
	{
	var
		el = this.el, clone = this.cloneEl
	;
		clone.innerHTML = el.value.substr(0, cursor.ch).replace(/ /g, '&nbsp;');

		return {
			left: el.offsetLeft + clone.offsetWidth,
			top: el.offsetTop,
			bottom: el.offsetTop + el.clientHeight,
			right: 0
		};
	}

});

ide.Bar.Search = ide.Bar.extend({

	el: '#search',

	reverse: false,

	run: function()
	{
	},

	cancel: function()
	{
	},

	on_change: function(val)
	{
	var
		regex
	;
		try { regex = val && new RegExp(val, 'm'); } catch(e) { regex = val; }

		if (ide.editor && ide.editor.search)
			ide.editor.search(regex, { backwards: this.reverse });
	}

});

ide.registerCommand('ex', function() {
	ide.commandBar.show();
});

ide.registerCommand('searchbar', function() {
	ide.searchBar.reverse = false;
	ide.searchBar.show();
});
ide.registerCommand('searchbarReverse', function() {
	ide.searchBar.reverse = true;
	ide.searchBar.show();
});

})(this.ide, this.cxl, this.jQuery);
