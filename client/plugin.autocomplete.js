
(function(ide, _, $) {
"use strict";

ide.plugins.register('autocomplete', new ide.Plugin({

	/// Autocomplete data
	data: null,
	/// Delay time in ms
	delay: 100,

	select_box: null,
	shortcut: 'ctrl-space',

	handlers: null,

	// Register autocomplete handler
	register: function(mime, handler)
	{
		this.handlers[mime] = handler;
		return this;
	},

	invoke: function()
	{
	var
		editor = ide.editor,
		token = editor.get_token && editor.get_token(),
		mime = editor && editor.file && editor.file.get &&
			editor.file.get('mime'),
		handler = mime && this.handlers[mime]
	;
		this.reset();

		if (handler)
			handler.autocomplete(editor.file, editor.get_position(), token);
		else
			ide.alert('Autocomplete not available.');
	},

	reset: function()
	{
		this.options = null;
		this.select_box.html('');
	},

	on_cursorchange: function()
	{
		if (!this.options)
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

		this.select_box.css(pos)
			.show()
		;
	},

	add: function(result)
	{
	var
		html='', val, i=0, sb = this.select_box[0]
	;
		this.options = this.options ? this.options.concat(result) :
			(this.show(), result);

		while ((val = result[i++]))
		{
			html += '<button>' + val.name;
			if (val.tags)
				html += ' <span class="label">' + val.tags + '</span>';
			html += '</button>';
		}

		this.select_box.append(html);

		sb.style.bottom = (sb.offsetTop + sb.offsetHeight > window.innerHeight) ?
			0 : '';
	},

	start: function()
	{
		this.handlers = {};
		this.select_box = $('<menu class="ide-select">')
			.appendTo(window.document.body);

		ide.on('cursorchange', this.on_cursorchange, this);
		ide.on('scroll', this.select_box.hide, this.select_box);
		ide.on('autocomplete', this.invoke, this);
	}

}));

})(window.ide, window._, window.jQuery);