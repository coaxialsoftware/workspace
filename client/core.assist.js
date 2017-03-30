
(function(window, ide, cxl) {
"use strict";
	
ide.Hint = class Hint extends ide.Item {
	
	template(obj)
	{
		if (obj.matchStart!==undefined)
		{
			obj.title = obj.title.slice(0, obj.matchStart) + '<b>' +
				obj.title.slice(obj.matchStart, obj.matchEnd) + '</b>' +
				obj.title.slice(obj.matchEnd);
		}
		
		return super.template(obj);
	}
	

};
	
var InlineAssist = function() {
	this.hints = [];
	this.el = document.getElementById('assist-inline');
	this.requestHints = cxl.debounce(this._requestHints.bind(this));
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

cxl.extend(InlineAssist.prototype, {

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
	
	/// Selected hint value
	selectedValue: null,

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
		token = token || editor.token && editor.token.current;
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

		if (editor.insert && !editor.insert.enabled)
			return this.hide();
		else
			this.requestHints(this.editor = editor || ide.editor, token);
	},

	calculateLeft: function()
	{
	var
		pos = this.pos = this.token && this.token.getCoordinates()
	;
		// TODO ?
		this.leftPos = Math.round(pos.left);
	},

	calculateTop: function()
	{
	var
		el = this.el, pos = this.pos, clientHeight = el.clientHeight,
		bottom = pos.bottom + clientHeight,
		viewHeight = window.innerHeight,
		isDown = bottom <= viewHeight,
		height = isDown ? pos.bottom : pos.top - clientHeight,
		translate = 'translate(' + this.leftPos + 'px,' + height + 'px)'
	;
		if (this.translateStr!==translate)
			this.el.style.transform = this.translateStr = translate;
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

	getIndex: function(title, priority)
	{
		var i=0, hints=this.hints, l=hints.length;

		for(;i<l;i++)
			if (hints[i].priority>priority && hints[i].title > title)
				return i;

		return l;
	},

	add: function(hint)
	{
	var
		order = this.getIndex(hint.title, hint.priority),
		ref = this.hints[order]
	;
		// Make sure there are no duplicates.
		if (ref && ref.value === hint.value)
			return;

		if (!hint.icon)
			// TODO?
			hint.icon = 'question-circle-o';

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
			//this.copyFont(editor.$content || editor.el);
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
		this.selectedValue = hint.value;
	},

	renderHint: function(hint, order, ref)
	{
		hint.el.$hint = hint;

		if (this.selectedValue === hint.value)
			this.select(hint);
		else
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
		token = this.token,
		value = this.selectedValue
	;
		if (value && token)
			token.replace(value);

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
	el: 'assist',
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
		this.requestHints = cxl.debounce(this._requestHints, this.delay);
		this.el.innerHTML = '<div class="assist-hints"></div>';
		this.$hints = this.el.children[0];
		
		this.listenTo(this.$hints, 'click', this.onItemClick);
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
		document.body.appendChild(ide.logger.el);
		this.el.classList.remove('assist-show');
		this.visible = false;
		
		ide.workspace.el.classList.remove('assist-show');
		ide.hash.set({ a: false });
	},

	show: function()
	{
		this.el.classList.add('assist-show');
		this.el.insertBefore(ide.logger.el, this.$hints);
		this.visible = true;
		ide.workspace.el.classList.add('assist-show');
		this._requestHints();
		ide.hash.set({ a: 1 });
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
		token = editor && editor.token && editor.token.current,
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
	
	sortedLastIndexBy: function(hint)
	{
		var l = this.hints.length;
		
		while (l--)
		{
			if (hint.priority > this.hints[l].priority)
				return l;
		}
		
		return 0;
	},

	renderHint: function(hint, i)
	{
		i = i===undefined ? this.sortedLastIndexBy(hint) : i;

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
		if (this.hints)
		{
			var hints = this.hints = cxl.sortBy(this.hints, 'priority');
			hints.forEach(this.appendHint, this);
		}

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

		if (ide.hash.data.a)
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
