
(function(ide, _, $) {
"use strict";

var Assistant = ide.Editor.extend({

});

var Live = ide.Editor.extend({

	initialize: function(options)
	{
		options.editor.on('write', this.refresh, this);

		this.$el.on('click', this.on_focus.bind(this));
		this.options = options;
		this.render();
	},

	on_focus: function()
	{
		this.focus();
	},

	getUrl: function()
	{
		var random = Math.random().toString(36);
		return this.options.url + (this.options.url.indexOf('?') === -1 ?
			'?random=' : '&random=') + random;
	},

	render: function()
	{
		var iframe = this.$iframe = $('<IFRAME>');
		var input = this.$input = $('<input value="' + this.options.url + '">');

		iframe.attr('src', this.getUrl());
		input.attr('readonly', 'readonly');

		this.$el.addClass('ide-live')
			.append(iframe)
			.append(input)
		;
	},

	refresh: function()
	{
		this.$iframe.attr('src', this.getUrl());
	}

});

// Assistant instance
var assist;

ide.commands.assist = function()
{
	ide.workspace.add(assist || (assist = new Assistant()));
};

ide.commands.live = function(url)
{
	ide.workspace.add(new Live({
		url: url,
		editor: ide.editor
	}));
};

ide.plugins.register('tern', ide.Plugin.extend({

	files: null,
	server: null,
	defs: null,
	delay: 250,

	selectBox: null,
	shortcut: 'ctrl-32',

	doInvoke: function(attr, pos)
	{
		this.server.addFile(attr.filename, ide.editor.get_value());

		this.server.request({
			query: {
				type: 'completions',
				types: true,
				file: attr.filename,
				end: { line: pos.row, ch: pos.column }
			}
		}, this.request_callback.bind(this, pos));
	},

	invoke: function()
	{
		// TODO might be dangerous
		this._force = true;
		this.doInvoke(ide.editor.file.attributes, ide.editor.editor.getCursorPosition());
	},

	on_cursorchange: function(editor, pos)
	{
	var
		me = this,
		file = editor.file,
		attr = file && file.get('mime')==='application/javascript' &&
			file.attributes
	;
		this.selectBox.hide();

		if (this.server && attr && editor.get_state()==='insertMode')
		{
			if (this.timeoutId)
				clearTimeout(this.timeoutId);

			this.timeoutId = window.setTimeout(function() {
				me.doInvoke(attr, pos);
			}, this.delay);
		}
	},

	request_callback: function(pos, err, result)
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

			this.selectBox.html(html)
				.css('left', cursor.offsetLeft - (i-result.start+1)*editor.renderer.characterWidth |0)
				.css('top', cursor.offsetTop + cursor.clientHeight)
				.appendTo(editor.renderer.$cursorLayer.element)
				.show()
			;

			if (cursor.offsetTop + cursor.clientHeight + this.selectBox.height() >
			editor.renderer.$cursorLayer.element.clientHeight)
				this.selectBox.css('bottom', 0);
			else
				this.selectBox.css('bottom', '');

		}

	},

	on_ready: function()
	{
	var
		defs = [],
		i
	;
		for (i in this.defs)
			defs.push(this.defs[i].json);

		this.server = new window.tern.Server({
			async: true,
			defs: defs
		});

		for (i in this.files)
			this.server.addFile(this.files[i].source, this.files[i].raw);
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
	var
		l = this.loader = new window.Loader()
	;
		this.files = {};
		this.selectBox = $('<OL class="ide-select">')
			.mousedown(this.on_click.bind(this))
		;

		//ide.on('cursorchange', this.on_cursorchange, this);
		ide.on('autocomplete', this.invoke, this);
		ide.on('scroll', function() {
			this.selectBox.hide();
		}, this);

		this.defs = {
			ecma5: l.json('build/ecma5.json')
		};

		l.ready(this.on_ready.bind(this));
	}

}));

})(window.ide, window._, window.jQuery);
