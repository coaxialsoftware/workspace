
(function(ide, _, $) {
"use strict";

ide.plugins.register('autocomplete', new ide.Plugin({

	/// Autocomplete data
	data: null,
	/// Delay time in ms
	delay: 250,

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
		mime = editor && editor.file && editor.file.get &&
			editor.file.get('mime')
	;
		if (mime)
			this.handlers[mime].autocomplete(editor.file, editor.get_position(),
			editor.token);
	},

	on_cursorchange: function(editor)
	{
	var
		file = editor.file
	;
		if (!file)
			return;

		this.select_box.hide();

		if (this.timeoutId)
			clearTimeout(this.timeoutId);

		this.timeoutId = window.setTimeout(this.invoke.bind(this), this.delay);
	},

	on_data: function(pos, err, result)
	{
	var
		editor = ide.editor.editor,
		html='',
		cursor,	val, i=0
	;

		if (result && result.completions.length &&
			(result.start!==result.end || this._force))
		{
			this._force = false;

			while ((val = result.completions[i++]))
			{
				html += '<LI>' + val.name + ' <span class="label">' +
					val.type + '</span></LI>';
			}

			cursor = editor.renderer.$cursorLayer.cursor;
			i = editor.session.doc.positionToIndex(pos);

			this.select_box.html(html)
				.css('left', cursor.offsetLeft - (i-result.start+1) *
					editor.renderer.characterWidth |0)
				.css('top', cursor.offsetTop + cursor.clientHeight)
				.appendTo(editor.renderer.$cursorLayer.element)
				.show()
			;

			if (cursor.offsetTop + cursor.clientHeight + this.select_box.height() >
			editor.renderer.$cursorLayer.element.clientHeight)
				this.select_box.css('bottom', 0);
			else
				this.select_box.css('bottom', '');
		}

	},

	start: function()
	{
		this.handlers = {};
		this.select_box = $('SELECT');

		//ide.on('cursorchange', this.on_cursorchange, this);
		ide.on('scroll', this.select_box.hide, this.select_box);
		ide.on('autocomplete', this.invoke, this);
	}

}));

})(window.ide, window._, window.jQuery);