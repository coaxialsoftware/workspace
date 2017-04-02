
(function(ide, cxl) {
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
	
	run: function() { },

	findWord: function(cb)
	{
	var
		el = this.$input,
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
					this.on_complete();
			},
			219: function(ev) {
				if (ev.ctrlKey)
				{
					this.cancel(); this.hide();
				}
			}
		};
		
		this.$input = this.el.children[0];

		this.listenTo(this.$input, 'keyup', this.on_keyup);
		this.listenTo(this.$input, 'keydown', this.on_key);
		this.listenTo(this.$input, 'keypress', this.on_keypress);
		this.listenTo(this.$input, 'blur', this.on_blur);
		// TODO?
		this.insert.enabled = true;
	},

	on_blur: function(ev)
	{
		var rel = ev.relatedTarget, assist = ide.assist.inline.el;
		// Prevent assist window from hiding
		if (rel && (rel===assist || rel.parentNode===assist))
		{
			ev.preventDefault();
			this.$input.focus();
		}
		else
			this.hide();
	},

	on_keyup: function(ev)
	{
		if (this.$input.value!==this._value)
		{
			this._lastSearch = null;
			if (this.on_change)
				this.on_change(this.$input.value);
		}

		this._value = this.$input.value;

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
		cxl.extend(this._keys, k);
	},

	show: function(val)
	{
		val = val || '';
		this.$input.value = val;
		this.el.style.display = 'block';
		
		if (val.length)
			this.$input.setSelectionRange(val.length, val.length);
		
		this.hidden = false;
		this.focus();
	},

	focus: function()
	{
		this.$input.focus();
	},

	insert: function(text)
	{
	var
		val = this.$input.value,
		start = this.$input.selectionStart
	;
		this.$input.value = val.slice(0, start) + text + val.slice(start);
		this.on_keyup();
	},

	replaceRange: function(text, start, end)
	{
	var
		val = this.$input.value
	;
		this.$input.value = val.slice(0, start.ch) + text + val.slice(end.ch);
		this.on_keyup();
	},

	hide: function()
	{
		this.el.style.display = 'none';
		this.hidden = true;
		this.ignoreChange = false;
		ide.assist.cancel();

		if (ide.editor)
			ide.editor.focus.set();

		ide.assist.inline.hide();

		return false;
	}

});

ide.Bar.Command = ide.Bar.extend({

	el: 'command',

	history: [],
	history_max: 50,
	history_index: 0,
	cloneEl: null,

	history_up: function(ev)
	{
		var val = this.history[this.history_index++];

		if (val)
			this.$input.value = val;

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

	render: function()
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
		val = this.$input.value,
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
	
	getToken: function(s, start, end)
	{
	var
		cmd = ide.commandParser.parse(this.$input.value, true),
		me = this,
		result = this.token = {
			getCoordinates: this.getCursorCoordinates.bind(this, { line: 0, ch: start }),
			replace: function(val) {
				me.replaceRange(val, { line: result.row, ch: result.column },
					{ line: result.cursorRow, ch: result.cursorColumn });
			}
		}
	;
		result.row = 0;
		result.column = start;
		result.cursorColumn = end;
		result.cursorRow = 0;
		result.value = s;
		
		// TODO ? 
		result.type = cmd[0].args ? 'file' : 'command';
		// state: cmd[cmd.length-1]
		return result;
	},

	on_change: function()
	{
		if (this.ignoreChange===true)
			return (this.ignoreChange = false);
		
		this.selectedHint = null;
		this.findWord(function(s, start, end) {
			ide.plugins.trigger('token', this, this.getToken(s, start, end));
		});
	},

	on_complete: function()
	{
	var
		inline = ide.assist.inline,
		hints = inline.hints,
		i = this.selectedHint
	;
		if (i===null)
			i = hints.indexOf(inline.selected);
		if (i === -1)
			return;
		
		i = (i === hints.length-1) ? 0 : i+1;
			
		this.ignoreChange = true;
		this.selectedHint = i;
		this.replaceRange(hints[i].value,
			{ ch: this.token.column }, { ch: this.token.cursorColumn });
		this.token.cursorColumn = this.token.column + hints[i].value.length;
	},

	getCursorCoordinates: function(cursor)
	{
	var
		el = this.el, input = this.$input, clone = this.cloneEl
	;
		clone.innerHTML = input.value.substr(0, cursor.ch).replace(/ /g, '&nbsp;');

		return {
			left: el.offsetLeft + clone.offsetWidth,
			top: el.offsetTop,
			bottom: el.offsetTop + el.clientHeight,
			right: 0
		};
	}

});

ide.Bar.Search = ide.Bar.extend({

	el: 'search',

	reverse: false,

	on_change: function(val)
	{
	var
		regex
	;
		try { regex = val && new RegExp(val, 'm'); } catch(e) { regex = val; }

		if (ide.editor && ide.editor.search)
			ide.editor.search.search(regex, this.reverse);
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
