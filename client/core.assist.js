
(function(window, ide, cxl, _) {
"use strict";

ide.Hint = ide.Item;

var InlineAssist = function() {
	this.hints = [];
	this.el = cxl.id('assist-inline');
	this.requestHints = _.debounce(this._requestHints.bind(this));
	this.cursor = { line: 0, ch: 0 };
	this.add = this.add.bind(this);
	this.doAccept = this.doAccept.bind(this);

	ide.plugins.on('editor.scroll', this.hide, this);
	this.el.addEventListener('click', this.onClick.bind(this), true);
	window.addEventListener('resize', this.hide.bind(this));
	window.addEventListener('click', this.hide.bind(this));

	ide.plugins.on('token', this.onToken.bind(this));

	ide.registerCommand('inlineAssistNext', this.next, this);
	ide.registerCommand('inlineAssistPrevious', this.previous, this);
	ide.registerCommand('inlineAssistAccept', this.accept, this);
	ide.registerCommand('inlineAssistHide', this.hide, this);
};

_.extend(InlineAssist.prototype, {

	hints: null,
	visible: false,
	editor: null,
	/// Current token
	token: null,
	/// Current token position
	pos: null,

	/// How often to send assist requests
	delay: 100,

	/// Request version
	version: 0,

	/// Selected hint
	selected: null,

	onClick: function(ev)
	{
		var hint, el=ev.target;

		do {
			hint = el.$hint;
			el= el.parentNode;
		} while (!hint || !el);

		if (hint)
		{
			this.select(hint);
			this.doAccept();
		}
	},

	_requestHints: function(editor, token)
	{
		token = token || editor.token;
	var
		file = editor.file instanceof ide.File && editor.file
	;
		this.version++;
		this.editor = editor;
		this.token = token;
		this.hints = [];
		this.el.innerHTML = '';
		this.selected = null;
		ide.keymap.setUIState(null);
		this.calculateLeft(editor);

		ide.plugins.trigger('assist.inline',
			this.addHints.bind(this, this.version), editor, token);

		ide.socket.send('assist.inline', {
			$: this.version,
			file: file && file.id,
			mime: file && file.attributes.mime,
			token: token,
			project: ide.project.id
		});
	},

	onToken: function(editor, token)
	{
		this.cursor.line = token.line;
		this.cursor.ch = token.start;

		if (editor.option && editor.option('disableInput'))
			return this.hide();
		else
			this.requestHints(this.editor = editor || ide.editor, token);
	},

	calculateLeft: function(editor)
	{
	var
		pos = this.pos = editor.getCursorCoordinates &&
			editor.getCursorCoordinates(this.cursor)
	;
		this.leftPos = Math.round(pos.left);
	},

	calculateTop: function()
	{
	var
		el = this.el, pos = this.pos,
		bottom = pos.bottom + el.clientHeight,
		viewHeight = window.innerHeight,
		isDown = bottom <= viewHeight,
		height = isDown ? pos.bottom : pos.top - el.clientHeight
	;
		this.el.style.transform = 'translate(' + this.leftPos + 'px,' + height + 'px)';
	},

	addHints: function(version, hints)
	{
		if (version !== this.version || !hints)
			return;

		ide.keymap.setUIState('inlineAssist');
		hints.forEach(this.add);

		if (!this.visible)
			this.show(this.editor);

		if (!this.selected && this.hints.length)
			this.select(this.hints[0]);
	},

	getIndex: function(title)
	{
		var i=0, hints=this.hints, l=hints.length;

		for(;i<l;i++)
			if (hints[i].title > title)
				return i;

		return l;
	},

	add: function(hint)
	{
	var
		order = this.getIndex(hint.title),
		ref = this.hints[order]
	;
		// Make sure there are no duplicates.
		if (ref && ref.title === hint.title)
			return;

		hint = hint instanceof ide.Hint ? hint : new ide.Hint(hint);

		this.hints.splice(order, 0, hint);

		if (this.visible)
			this.renderHint(hint, order, ref);
	},

	clear: function()
	{
		if (this.hints.length)
			this.hints = [];
	},

	copyFont: function(el)
	{
		// TODO optimize?
		var style = window.getComputedStyle(el);
		this.el.style.fontFamily = style.fontFamily;
		this.el.style.fontSize = style.fontSize;
	},

	show: function(editor)
	{
		editor = this.editor = editor || ide.editor;

		if (!this.visible)
		{
			this.visible = true;
			this.copyFont(editor.el);
			this.el.style.display='block';
			this.render();
		}
	},

	select: function(hint)
	{
		if (this.selected && this.selected!== hint)
			this.selected.el.classList.remove('selected');

		hint.el.classList.add('selected');

		this.selected = hint;
	},

	renderHint: function(hint, order, ref)
	{
		hint.el.$hint = hint;

		if (this.selected !== hint)
			hint.el.classList.remove('selected');

		if (ref)
			this.el.insertBefore(hint.el, ref.el);
		else
			this.el.appendChild(hint.el);

		this.calculateTop();
	},

	hide: function()
	{
		this.requestHints.cancel();

		if (this.visible)
		{
			this.el.style.display='none';
			this.el.innerHTML = '';
			this.visible = false;
			ide.keymap.setUIState(null);
		}
	},

	render: function()
	{
	var
		i=0, hints = this.hints, l=hints.length
	;
		if (l===0 || (l===1 && hints[0].title === this.token.string))
			this.hide();
		else
			for (; i<l; i++)
				this.renderHint(hints[i], i);
	},

	_goNext: function(dir)
	{
	var
		selected = this.selected.el,
		next = selected[dir || 'nextSibling'],
		el = this.el, h
	;
		if (next)
		{
			this.select(next.$hint);

			h = next.offsetTop + next.offsetHeight;

			if (h > el.scrollTop + el.clientHeight)
				el.scrollTop = h - el.clientHeight;
			else if (next.offsetTop < el.scrollTop)
				el.scrollTop = next.offsetTop;
		}
	},

	/** Go to next suggestion */
	next: function()
	{
		return this._goNext();
	},

	previous: function()
	{
		return this._goNext('previousSibling');
	},

	doAccept: function()
	{
	var
		editor = this.editor,
		token = this.token,
		hint = this.selected,
		value
	;
		if (hint && token && editor.replaceRange)
		{
			value = hint.value || hint.title;

			editor.replaceRange(value,
				{ ch: token.start, line: token.line },
				{ ch: token.ch, line: token.line }, 'assist.inline'
			);
		}

		this.hide();
	},

	accept: function()
	{
		// make sure all suggestions are in before accepting it...
		// TODO find a better way?
		//this.requestHints.cancel();
		//this._requestHints(this.editor, this.editor.token);
		
		if (this.hints.length===0)
			return ide.Pass;
		
		setTimeout(this.doAccept, this.delay);
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
		cxl.$body.append(ide.logger.el);
		this.$el.removeClass('assist-show');
		this.visible = false;
		ide.workspace.$el.removeClass('assist-show');
		ide.workspace.hash.set({ a: false });
	},

	show: function()
	{
		this.$el.addClass('assist-show');
		this.el.insertBefore(ide.logger.el, this.$hints);
		this.visible = true;
		ide.workspace.$el.addClass('assist-show');
		this._requestHints();
		ide.workspace.hash.set({ a: 1 });
	},

	cancel: function()
	{
		this.version++;
		this.requestHints.cancel();
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
		if (version!==this.version || !this.visible || !hints)
			return;

		if (Array.isArray(hints))
			hints.forEach(this.addHint.bind(this, version));
		else
		{
			var h = hints instanceof ide.Hint ? hints : new ide.Hint(hints);

			if (this.rendered)
				this.renderHint(h);
			else
				this.hints.push(h);
		}
	},

	renderHint: function(hint, i)
	{
		i = i===undefined ?
			_.sortedLastIndexBy(this.hints, hint, 'priority') :
			i
		;

		var ref = this.hints[i];

		if (ref && ref !== hint)
		{
			this.hints.splice(i, 0, hint);
			this.$hints.insertBefore(hint.el, ref.el);
		} else
			this.$hints.appendChild(hint.el);
	},

	appendHint: function(hint)
	{
		this.$hints.appendChild(hint.el);
	},

	render: function()
	{
		var hints = this.hints = _.sortBy(this.hints, 'priority');
		hints.forEach(this.appendHint, this);
		this.rendered = true;
	}

});

ide.plugins.register('assist', new ide.Plugin({

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

	onInline: function(data)
	{
		ide.assist.inline.addHints(data.$, data.hints);
	},

	ready: function()
	{
		ide.assist = new Assist();

		this.listenTo('assist', this.onAssist);
		this.listenTo('socket.message.assist', this.onSocket);
		this.listenTo('socket.message.assist.inline', this.onInline);

		if (ide.workspace.hash.data.a)
			ide.assist.show(ide.assist);
	}

}));

ide.keymap.registerKeys({

	inlineAssist: {

		down: 'inlineAssistNext',
		up: 'inlineAssistPrevious',
		enter: 'inlineAssistAccept',
		tab: 'inlineAssistAccept',
		esc: 'inlineAssistHide'

	}

});

})(this, this.ide, this.cxl, this._);