((ide, cxl) => {
"use strict";

class Bar {

	constructor(el)
	{
		this.el = el;

		/**
		 * When a key is pressed and its found here the
		 * function will be called. Use keys function to
		 * assign more bindings.
		 *
		 * @private
		 */
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

		/**
		 * Previous Value
		 */
		this._value = '';
		this.$input = this.el.children[0];

		this.listenTo(this.$input, 'keyup', this.on_keyup);
		this.listenTo(this.$input, 'keydown', this.on_key);
		this.listenTo(this.$input, 'keypress', this.on_keypress);
		this.listenTo(this.$input, 'blur', this.on_blur);
		// TODO?
		this.insert.enabled = true;
	}

	listenTo(el, type, fn)
	{
		cxl.listenTo(el, type, fn.bind(this));
	}

	/** @abstract */
	cancel() { }

	run() { }

	findWord(cb)
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
	}


	on_blur(ev)
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
	}

	on_keyup(ev)
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
	}

	on_keypress(ev)
	{
		ev.stopPropagation();
	}

	on_key(ev)
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
	}

	keys(k)
	{
		cxl.extend(this._keys, k);
	}

	show(val)
	{
		val = val || '';
		this.$input.value = val;
		this.el.style.display = 'block';

		if (val.length)
			this.$input.setSelectionRange(val.length, val.length);

		this.hidden = false;
		this.focus();
	}

	focus()
	{
		this.$input.focus();
	}

	insert(text)
	{
	var
		val = this.$input.value,
		start = this.$input.selectionStart
	;
		this.$input.value = val.slice(0, start) + text + val.slice(start);
		this.on_keyup();
	}

	replaceRange(text, start, end, ignore)
	{
	var
		val = this.$input.value
	;
		if (ignore)
			this.ignoreChange = ignore;

		this.$input.value = val.slice(0, start) + text + val.slice(end);
		this.on_keyup();
	}

	hide()
	{
		this.el.style.display = 'none';
		this.hidden = true;
		this.ignoreChange = false;
		ide.assist.cancel();

		if (ide.editor)
			ide.workspace.focusEditor(ide.editor);

		ide.assist.inline.hide();

		return false;
	}

}

class CommandToken extends ide.Token {

	constructor(start, end, s)
	{
		super();
		this.row = 0;
		this.column = start;
		this.cursorColumn = end;
		this.cursorRow = 0;
		this.value = s;
	}

	getCoordinates()
	{
	var
		bar = ide.commandBar,
		el = bar.el,
		input = bar.$input,
		clone = bar.cloneEl
	;
		clone.innerHTML = input.value.substr(0, this.column).replace(/ /g, '&nbsp;');

		return {
			left: el.offsetLeft + clone.offsetWidth,
			top: el.offsetTop,
			bottom: el.offsetTop + el.clientHeight,
			right: 0
		};
	}

	replace(val)
	{
		ide.commandBar.replaceRange(val, this.column, this.cursorColumn, true);
	}

	getType()
	{
	var
		input = ide.commandBar.$input,
		val = input.value.slice(0, this.cursorColumn),
		// Parse command from beginning to cursor position
		parsed = ide.commandParser.parse(val, true),
		cmd
	;
		parsed = parsed[parsed.length-1];

		if (parsed.args)
		{
			// TODO Get last command always?
			cmd = ide.findCommand(parsed.fn);

			return cmd && cmd.args ? cmd.args[parsed.args.length-1] : 'file';
		}

		return 'command';
	}

	get type()
	{
		return this.$type || (this.$type = this.getType());
	}

}

ide.Bar = Bar;

ide.Bar.Command = class extends Bar {

	constructor()
	{
		super(document.getElementById('command'));

		this.history = [];
		this.history_max = 50;
		this.history_index = 0;
		this.cloneEl = null;
		this.selectedHint = null;
		this.render();
	}


	history_up(ev)
	{
		var val = this.history[this.history_index++];

		if (val)
			this.$input.value = val;

		ev.preventDefault();
	}

	history_add(val)
	{
		this.history_index = 0;
		this.history.unshift(val);
	}

	history_down(ev)
	{
		if (this.history_index>0)
			this.history_index -= 2;

		this.history_up(ev);
	}

	render()
	{
		this._keys[38] = this.history_up.bind(this);
		this._keys[40] = this.history_down.bind(this);

		this.$assistData = {};
		this.cloneEl = window.document.createElement('SPAN');
		this.cloneEl.className = 'command-bar-width';
		document.body.appendChild(this.cloneEl);
	}

	waitForPromise(cmd, promise)
	{
		var notification = ide.notify({
			title: cmd,
			progress: 0
		});

		promise.then(result => {
			this.onResult(cmd, result);
		}, this.onError).then(function() {
			notification.remove();
		});
	}

	onError(err)
	{
		ide.error(err);
	}

	onResult(cmd, result)
	{
		if (result===ide.Pass)
			ide.warn('Unknown Command: ' + cmd);
		else if (typeof(result)==='string' || result instanceof ide.Item)
			ide.notify(result);
		else if (result instanceof Promise)
			this.waitForPromise(cmd, result);
	}

	run()
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

		this.onResult(val, result);
	}

	getToken(s, start, end)
	{
	var
		result = this.token = new CommandToken(start, end, s)
	;
		this.token.current = this.token;
		return result;
	}

	getAssistData()
	{
		return Promise.resolve(this.$assistData);
	}

	on_change()
	{
		this.findWord(function(s, start, end) {
			var t = this.$assistData.token = this.getToken(s, start, end);

			if (this.ignoreChange===true)
				return (this.ignoreChange = false);

			this.selectedHint = null;
			ide.plugins.trigger('token', this, t);
		});
	}

	on_complete()
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
		this.replaceRange(hints[i].value, this.token.column, this.token.cursorColumn);
		this.token.cursorColumn = this.token.column + hints[i].value.length;
	}

};

ide.Bar.Search = class extends Bar {

	constructor()
	{
		super(document.getElementById('search'));
		this.reverse = false;
	}

	on_change(val)
	{
	var
		regex
	;
		try { regex = val && new RegExp(val, 'm'); } catch(e) { regex = val; }

		if (ide.editor && ide.editor.search)
			ide.editor.search.search(regex, this.reverse);
	}

};

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

})(this.ide, this.cxl);
