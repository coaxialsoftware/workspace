
(function(ide, _, $) {
"use strict";

ide.plugins.register('assist', new ide.Plugin({
	/// Autocomplete data
	data: null,
	/// Delay time in ms
	delay: 100,
	/// Current handler
	handler: null,

	/// selectbox is visible
	visible: false,

	select_box: null,
	shortcut: 'ctrl-space',

	handlers: null,

	// Register autocomplete handler
	register: function(mime, handler)
	{
		if (this.handlers[mime])
			this.handlers[mime].push(handler);
		else
			this.handlers[mime] = [ handler ];

		return this;
	},

	invoke: function()
	{
	var
		editor = ide.editor,
		mime = editor && editor.file && editor.file.get &&
			editor.file.get('mime'),
		handlers = this.handler = mime && this.handlers[mime]
	;
		this.reset();

		if (handlers)
			handlers.forEach(function(handler) {
				window.setTimeout(handler.autocomplete(editor));
			});
		else
			ide.alert('Autocomplete not available.');
	},

	reset: function()
	{
		this.visible = false;
		this.select_box.html('');
	},

	on_cursorchange: function()
	{
		if (!this.visible)
			return;

		if (this.timeoutId)
			clearTimeout(this.timeoutId);

		this.timeoutId = window.setTimeout(this.invoke.bind(this), this.delay);
	},

	show: function()
	{
	var
		c = ide.editor.get_cursor(),
		pos = $(c).offset()
	;
		pos.top += c.clientHeight;
		pos.font = ide.editor.get_font();

		this.visible = true;
		this.select_box.css(pos)
			.show()
		;
	},

	hide: function()
	{
		this.visible = false;
		this.select_box.hide();
		return this;
	},

	on_click: function(ev)
	{
		var data = ev.currentTarget.dataset;

		window.console.log(data.value);
		this.hide();

		ev.preventDefault();
		ev.stopPropagation();
	},

	/**
	 * HTML for autocomplete options. Default element is a button. Each element
	 * should provide a data-value attribute
	 */
	add: function(html)
	{
	var
		sb = this.select_box[0]
	;
		if (!this.visible)
			this.show();

		this.select_box.append(html);

		sb.style.bottom = (sb.offsetTop + sb.offsetHeight > window.innerHeight) ?
			0 : '';
	},

	start: function()
	{
		this.handlers = {};
		this.select_box = $('<menu class="ide-select">')
			.appendTo(window.document.body)
			.on('click', 'button', this.on_click.bind(this))
		;

		ide.on('cursorchange', this.on_cursorchange, this);
		ide.on('scroll', this.select_box.hide, this.select_box);
		ide.on('autocomplete', this.invoke, this);
	}

}));

})(this.ide, this._, this.jQuery);