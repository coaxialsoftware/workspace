
ide.Editor = j5ui.Widget.extend({

	init: function Editor(p)
	{
		j5ui.Widget.apply(this, arguments);
	},

	on_focus: function()
	{
		ide.set_editor(this);
	}

});

ide.Bar = j5ui.Widget.extend({

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

	invoke: function()
	{
		this.show();
	},

	init: function Bar()
	{
		j5ui.Widget.apply(this);

		this._keys = {
		// TODO Use Key constants
		27: function() { this.hide(); },
		13: function() { this.run(); this.hide(); },
		8: function() {
			if (this._value==='')
				this.hide();
			},
		9: function() {
		var
			el = this.element,
			i = el.value.lastIndexOf(' ', el.selectionStart)+1,
			text = ''
		;
			text = el.value.substr(i, el.selectionStart-i);

			this.on_complete && this.on_complete(text, i, el.selectionStart);
		},
		219: function(ev) {
			if (ev.ctrlKey)
				this.hide();
		}
		};

		this.on('keyup', this.on_key);
		this.on('keydown', this.on_keydown);
		this.on('blur', this.on_blur);
	},

	on_blur: function()
	{
		this.hide();
	},

	on_keydown: function(ev)
	{
		if (ev.keyCode===9)
			ev.preventDefault();
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

		if (this.element.value!==this._value)
		{
			this._lastSearch = null;
			this.on_change && this.on_change(this.element.value);
		}

		this._value = this.element.value;
		ev.stopPropagation();
		return false;
	},

	keys: function(k)
	{
		j5ui.extend(this._keys, k);
	},

	show: function()
	{
		this.element.value = '';
		this.element.style.display = 'block';
		this.hidden = false;
		this.focus();
	},

	focus: function()
	{
	var
		el = this.element
	;
		j5ui.refer(function() { el.focus(); });
	},

	hide: function()
	{
		this.element.style.display = 'none';
		this.hidden = true;
		if (ide.editor)
			ide.editor.focus();
		return false;
	},

	start: function()
	{
		document.body.appendChild(this.element);
	}

});

ide.Bar.Command = ide.Bar.extend({

	element: j5ui.html('<input id="command" />'),
	shortcut: "shift-186",

	scan: function(text)
	{
		return text.split(' ');
	},

	parse: function(text)
	{
	var
		cmd = this.scan(text),
		fn = ide.commands[cmd[0]],
		scope = ide
	;
		if (fn)
		{
			if (typeof(fn)==='string')
				fn = ide.commands[fn];
		} else if (ide.editor)
		{
			fn = ide.editor.cmd(cmd[0]);
			scope = ide.editor;
		}

		cmd.shift();

		return {
			fn: fn,
			args: cmd,
			scope: scope
		};
	},

	run: function()
	{
	var
		val = this.element.value,
		cmd
	;
		if (val==='')
			return;

		cmd = this.parse(val);

		if (!cmd.fn)
			j5ui.alert('Unknown Command: ' + val);
		else
			cmd.fn.apply(cmd.scope, cmd.args);

		console.log(val);
	},

	on_complete: function(s, start, end)
	{
	var
		val = this.element.value,
		match
	;
		if (!this._lastSearch)
		{
			this._lastSearch = ide.project.files_text.match(new RegExp('^' + s + '[^/\n]*$', 'mg'));
			this._lastSearchStart = start;
			this._lastSearchIndex = 0;
		} else if (this._lastSearchIndex===this._lastSearch.length)
			this._lastSearchIndex = 0;

		if (!this._lastSearch)
			return;

		match = this._lastSearch[this._lastSearchIndex++];
		this._value = this.element.value = val.slice(0, start) + match + val.slice(end);
	}

});

ide.Bar.Evaluate = ide.Bar.extend({

	shortcut: 'shift-49',
	element: j5ui.html('<input id="evaluate" />'),

	encode: function(response)
	{
		return response.toString().replace(/&/g, '&amp;').replace(/</g, '&lt;');
	},

	run: function()
	{
	var
		el = j5ui.dom('DIV'),
		response = eval(this.element.value)
	;
		if (response === undefined)
			return;

		j5ui.info(response);
	}

});

ide.Bar.Search = ide.Bar.extend({

	element: j5ui.html('<input id="search" />'),
	shortcut: '191',

	run: function()
	{
		//ide.editor.editor.findAll(new RegExp(this.element.value));
	},

	on_change: function(val)
	{
	var
		regex
	;
		if (ide.editor)
		{
			// Try with a regex first, if it is invalid, just use a string
			try { regex = new RegExp(val); }
			catch(e) { regex = val; }

			ide.editor.find(regex);
		}
	}

});

ide.plugins.register('evaluate', ide.Bar.Evaluate);
ide.plugins.register('search', ide.Bar.Search);
ide.plugins.register('command', ide.Bar.Command);

ide.plugins.register('error', ide.Plugin.extend({

	_error: function(error, url, line)
	{
		j5ui.error(error.message);
		console.error(error);
	},

	start: function()
	{
		window.addEventListener('error', this._error.bind(this));
	}

}));
