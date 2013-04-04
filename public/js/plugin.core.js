
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
			this.on_complete && this.on_complete();
		},
		219: function(ev) {
			if (ev.ctrlKey)
				this.hide();
		}
		};
	
		this.on('keyup', this.on_key);
		this.on('keydown', this.on_keydown);
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
		{
			fn.apply(this, [ ev ]);
		} else if (
			this.on_change && 
			this.element.value!==this._value
		) {
			this.on_change(this.element.value);
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
	}

});

IDE.Bar.Search = IDE.Bar.extend({
	
	element: j5ui.html('<div id="#search"></div>'),

	run: function()
	{
		
	},

	on_change: function(val)
	{
		project.editor.editor.find(new RegExp(val));
	}

});

IDE.Editor.Source = IDE.Editor.extend({
		
	file: null,
	editor: null,
	session: null,
	modes: { },

	setup: function()
	{
	var
		editor = this.editor = ace.edit(this.element),
		session = editor.getSession()
	;
		editor.setValue(this.file.content);
		editor.setTheme('ace/theme/twilight');
		editor.container.style.fontSize = '16px';
		editor.setKeyboardHandler('ace/keyboard/vim');
		editor.setBehavioursEnabled(true);
		editor.setDisplayIndentGuides(false);
		session.setUseSoftTabs(false);

		editor.selection.clearSelection();
		editor.on('focus', this.on_focus.bind(this));

		this.set_mode();
		this.on('keyup', this._on_keyup);
		j5ui.refer(this.focus.bind(this), 350);
	},

	_on_keyup: function(ev)
	{
		if (this.get_state()==='insertMode')
		{
			ev.stopPropagation();
			return false;
		}
	},

	focus: function()
	{
		this.editor.focus();
		this.editor.resize();
	},

	close: function()
	{
		this.editor.destroy();
		this.remove();
	},

	write: function()
	{
		this.file.save();
	},
	
	get_state: function()
	{
		return this.editor.keyBinding.$data.state;
	},

	get_status: function()
	{
		return this.editor.$vimModeHandler.getStatusText();
	},

	set_mode: function()
	{
	var
		mode = this.modes[this.file.mime]
	;
		if (!mode)
			mode = 'ace/mode/' + this.file.mime.split('/')[1];

		this.editor.session.setMode(mode);
	}

});

ide.plugin('editor.source', {
	
	edit: function(file)
	{
		ide.workspace.add(new IDE.Editor.Source({ file: file }));
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
	
	_error: function(msg, url, line)
	{
		j5ui.error(msg);
		console.error(msg);
	},

	setup: function()
	{
		window.addEventListener('error', this._error.bind(this));
	}

});
