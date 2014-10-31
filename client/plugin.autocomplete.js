
(function(ide, _, $) {
"use strict";

ide.plugins.register('autocomplete', new ide.Plugin({

	/// Autocomplete data
	data: null,
	/// Delay time in ms
	delay: 250,

	select_box: null,
	shortcut: 'ctrl-space',

	invoke: function()
	{
		if (ide.editor.file)
			ide.trigger('autocomplete', ide.editor.file, ide.editor.get_position());
	},

	on_cursorchange: function(editor, pos)
	{
	var
		me = this,
		file = editor.file,
		attr = file && file.get('mime')==='application/javascript' &&
			file.attributes
	;
		this.select_box.hide();

		if (this.server && attr && editor.get_state()==='insertMode')
		{
			if (this.timeoutId)
				clearTimeout(this.timeoutId);

			this.timeoutId = window.setTimeout(function() {
				me.doInvoke(attr, pos);
			}, this.delay);
		}
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

	load_files: function(files)
	{
		for (var i in files)
			this.files[files[i]] = this.loader.data(files[i]);
	},

	on_click: function()
	{
		return false;
	},

	start: function()
	{
		this.data = {};
		this.select_box = $('SELECT');

		//ide.on('cursorchange', this.on_cursorchange, this);
		ide.on('scroll', this.select_box.hide, this.select_box);
	}

}));

})(window.ide, window._, window.jQuery);