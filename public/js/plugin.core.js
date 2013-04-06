
IDE.Editor = j5ui.Widget.extend({

	init: function Editor(p)
	{
		j5ui.Widget.apply(this, arguments);

	},

	on_focus: function()
	{
		ide.set_editor(this);
	},

	get_status: function()
	{
	}
		
});

IDE.Panel = j5ui.Widget.extend({
	
	css: 'ide-panel'
	
});

IDE.Bar = j5ui.Widget.extend({

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
	}

});

IDE.Bar.Command = IDE.Bar.extend({

	element: j5ui.html('<input id="command" />'),
	
	run: function()
	{
		ide.eval(this.element.value);
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
		
		match = this._lastSearch[this._lastSearchIndex++];
		this._value = this.element.value = val.slice(0, start) + match + val.slice(end);
	}

});

IDE.Bar.Evaluate = IDE.Bar.extend({
	
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
	
})

IDE.Bar.Search = IDE.Bar.extend({
	
	element: j5ui.html('<input id="search" />'),

	run: function()
	{
	},

	on_change: function(val)
	{
		if (ide.editor)
			ide.editor.find(new RegExp(val));
	}

});


ide.plugin('eval', {
	
	shortcut: 'shift-49',
	
	invoke: function()
	{
		this.bar.show();
	},
	
	setup: function()
	{
		this.bar = new IDE.Bar.Evaluate();
		document.body.appendChild(this.bar.element);
	}
	
});

ide.plugin('search', {
	
	shortcut: '191',
	
	invoke: function()
	{
		this.bar.show();
	},
	
	setup: function()
	{
		this.bar = new IDE.Bar.Search();
		document.body.appendChild(this.bar.element);
	}
	
});

ide.plugin('command', {
	
	shortcut: "shift-186",

	invoke: function()
	{
		this.bar.show();
	},
	
	setup: function()
	{
		this.bar = new IDE.Bar.Command();
		document.body.appendChild(this.bar.element);
	}

});

ide.plugin('error', {
	
	_error: function(error, url, line)
	{
		j5ui.error(error.message);
		console.error(error);
	},

	setup: function()
	{
		window.addEventListener('error', this._error.bind(this));
	}

});
