
(function(window, ide, cxl, _) {
"use strict";

ide.Hint = ide.Item;

var InlineAssist = function() {
	this.hints = [];
	this.el = document.createElement('DIV');
	this.el.setAttribute('id', 'assist-inline');
	this.debouncedShow = _.debounce(this.show.bind(this));
	this.cursor = { line: 0, ch: 0 };

	ide.plugins.on('editor.scroll', this.onScroll, this);
	window.addEventListener('click', this.onScroll.bind(this));
	window.addEventListener('resize', this.onScroll.bind(this));

	window.document.body.appendChild(this.el);
	ide.plugins.on('token', this.onToken.bind(this));
};

_.extend(InlineAssist.prototype, {

	hints: null,
	selected: 0,
	visible: false,
	version: 0,
	/// Current token position
	pos: null,

	onScroll: function()
	{
		if (this.visible)
			this.hide();
	},

	onToken: function(editor, token)
	{
		this.cursor.line = token.line;
		this.cursor.ch = token.start;
	var
		pos = this.pos = editor.getCursorCoordinates &&
			editor.getCursorCoordinates(this.cursor),
		style = this.el.style
	;
		style.left = Math.round(pos.left) + 'px';
	},

	calculateTop: function()
	{
	var
		el = this.el, pos = this.pos,
		bottom = pos.bottom + el.clientHeight,
		viewHeight = window.innerHeight
	;
		this.el.style.top = Math.round((bottom <= viewHeight) ?
			pos.bottom : pos.top - el.clientHeight) + 'px';
	},

	add: function(hint, version, editor)
	{
		var order = _.sortedLastIndex(this.hints, hint, 'priority');

		this.hints.splice(order, 0, hint);

		if (this.visible)
			this.renderHint(hint, order);

		if (editor.option && editor.option('disableInput'))
			this.hide();
		else
			this.debouncedShow(editor);
	},

	clear: function()
	{
		if (this.hints.length)
			this.hints = [];

		if (this.visible)
			this.el.innerHTML = '';
	},

	show: function(editor)
	{
		var style;

		editor = editor || ide.editor;

		if (!this.visible)
		{
			this.el.style.display='block';

			// TODO optimize?
			style = window.getComputedStyle(editor.el);
			this.el.style.fontFamily = style.fontFamily;
			this.el.style.fontSize = style.fontSize;

			this.visible = true;
			this.selected = 0;
			this.render();
		}
	},

	renderHint: function(hint, order)
	{
		var ref = this.hints[order];

		hint.el.classList.toggle('selected', order===this.selected);

		if (ref && ref !== hint)
			this.el.insertBefore(hint.el, ref.el);
		else
			this.el.appendChild(hint.el);
		this.calculateTop();
	},

	hide: function()
	{
		this.el.style.display='none';
		this.visible = false;
	},

	render: function()
	{
	var
		i=0, hints = this.hints, l=hints.length
	;
		if (l===0)
			this.hide();
		else
			for (; i<l; i++)
				this.renderHint(hints[i], i);
	}

});

var Assist = cxl.View.extend({
	el: '#assist',
	visible: false,
	delay: 200,

	/** Current requrest for hints version. */
	version: 0,
	/** Current Editor */
	editor: null,
	/** Current Token */
	token: null,

	inline: null,

	$hints: null,
	hints: null,

	initialize: function()
	{
		this.template = cxl.id('tpl-assist').innerHTML;
		this.requestHints = _.debounce(this._requestHints, this.delay);
		//this.listenTo(ide.plugins, 'file.write', this.onToken);
		this.listenTo(ide.plugins, 'token', this.onToken);
		this.listenTo(ide.plugins, 'editor.focus', this.onToken);
		this.listenTo(ide.plugins, 'editor.change', this.onToken);
		this.listenTo(ide.plugins, 'file.write', this.onOther);
		this.listenTo(ide.plugins, 'workspace.remove', this.onOther);

		this.inline = new InlineAssist();
	},

	onItemClick: function()
	{
		if (this.action)
		{
			if (this.type==='ex')
				ide.commandBar.show(this.action);
			else
				ide.commandParser.run(this.action);
		}
	},

	/**
	 * We use the editor provided, so plugins can override the current editor.
	 */
	onToken: function(editor)
	{
		this.requestHints(editor);
	},

	onOther: function() { this.requestHints(); },

	hide: function()
	{
		cxl.$body.append(ide.$notifications);
		this.$el.removeClass('assist-show');
		this.visible = false;
		ide.workspace.$el.removeClass('assist-show');
		ide.workspace.hash.set({ a: false });
	},

	show: function()
	{
		this.$el.addClass('assist-show');
		this.el.insertBefore(ide.$notifications, this.$hints);
		this.visible = true;
		ide.workspace.$el.addClass('assist-show');
		this._requestHints();
		ide.workspace.hash.set({ a: 1 });
	},

	_requestHints: function(editor)
	{
		editor = this.editor = editor || ide.editor;

	var
		token = editor && editor.token,
		file = editor && (editor.file instanceof ide.File) && editor.file,
		diff = file && file.diff()
	;
		this.version++;
		this.$hints.innerHTML = '';
		this.rendered = false;
		this.hints = [];
		this.inline.clear();

		ide.plugins.trigger('assist',
			this.addHint.bind(this, this.version), editor, token);

		ide.socket.send('assist', {
			$: this.version,
			file: file && file.id,
			mime: file && file.attributes.mime,
			token: token,
			project: ide.project.id,
			fileChanged: file && file.diffChanged,
			editor: editor && editor.id,
			diff: diff
		});

		this.render();
	},

	toggle: function()
	{
		return this.visible ? this.hide() : this.show();
	},

	/**
	 * @param hints {object|array} A Single hint or an array of hints.
	 */
	addHint: function(version, hints)
	{
		if (version!==this.version)
			return;

		if (Array.isArray(hints))
			hints.forEach(this.addHint.bind(this, version));
		else
		{
			if (!this.visible && hints.type!=='inline')
				return;

			var h = hints instanceof ide.Hint ? hints : new ide.Hint(hints);

			if (h.type==='inline')
				this.inline.add(h, version, this.editor);
			else if (this.rendered)
				this.renderHint(h);
			else
				this.hints.push(h);
		}
	},

	renderHint: function(hint, i)
	{
		i = i===undefined ?
			_.sortedIndex(this.hints, hint, 'priority') :
			i
		;

		var ref = this.hints[i];

		if (ref !== hint)
		{
			this.hints.splice(i, 0, hint);
			this.$hints.insertBefore(hint.el, ref.el);
		} else
			this.$hints.appendChild(hint.el);
	},

	render: function()
	{
		var hints = this.hints = _.sortBy(this.hints, 'priority');
		hints.forEach(this.renderHint, this);
		this.rendered = true;
	}

});

ide.plugins.register('assist', {

	commands: {
		assist: function() {
			this.openAssist();
		}
	},

	openAssist: function()
	{
		ide.assist.toggle();
	},

	onAssist: function(done)
	{
		var hints = [];

		if (!ide.workspace.slots.length)
		{
			hints.push({ title: 'Documentation', action: 'help' });

			if (ide.project.id)
			{
				hints.push([
					{ title: 'Open new file.', action: 'edit ', type: 'ex' },
					{ title: 'List project files', action: 'find'}
				]);
			} else
			{
				hints.push([
					{ title: 'Open Project', action: 'project ' },
					{ title: 'List Projects', action: 'projects' }
				]);
			}
		}

		done(hints);
	},

	onSocket: function(data)
	{
		ide.assist.addHint(data.$, data.hints);
	},

	ready: function()
	{
		ide.assist = new Assist();
		ide.plugins.on('assist', this.onAssist, this);
		ide.plugins.on('socket.message.assist', this.onSocket, this);

		if (ide.workspace.hash.data.a)
			window.setTimeout(ide.assist.show.bind(ide.assist), 150);
	}

});

})(this, this.ide, this.cxl, this._);