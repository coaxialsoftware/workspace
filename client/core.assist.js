
(function(window, ide, cxl) {
"use strict";

var InlineAssist = function() {
	this.hints = [];
	this.el = document.getElementById('assist-inline');
	this.hintsContainer = document.createElement('DIV');
	this.el.appendChild(this.hintsContainer);

	this.render = cxl.debounce(this._render);
	this.debouncedHide = cxl.debounce(this.hide, 250);
	this.add = this.add.bind(this);
	this.doAccept = this.doAccept.bind(this);

	this.scrollUpEl = document.createElement('ide-scroll-up');
	this.scrollDownEl = document.createElement('ide-scroll-down');

	function Next(prev, ev)
	{
		this._goNext(prev ? 'previousSibling' : null);
		ev.stopPropagation();
	}

	this.scrollUpEl.addEventListener('click', Next.bind(this, true));
	this.scrollDownEl.addEventListener('click', Next.bind(this, false));

	this.el.addEventListener('click', this.onClick.bind(this), true);
	window.addEventListener('resize', this.hide.bind(this));
	window.addEventListener('click', this.hide.bind(this));

	ide.plugins.on('editor.scroll', this.hide, this);

	ide.registerCommand('assist.inlineNext', this.next, this);
	ide.registerCommand('assist.inlinePrevious', this.previous, this);
	ide.registerCommand('assist.inlineAccept', this.accept, this);
	ide.registerCommand('assist.inlineHide', this.hide, this);
	ide.registerCommand('assist.inlineForce', this.forceRequest, this);
};

cxl.extend(InlineAssist.prototype, {

	hints: null,

	visible: false,
	/// Current token position
	pos: null,
	/// Number of items to show at a time
	visibleCount: 8,
	/// Start Item
	visibleStart: 0,
	/// Selected hint
	selected: null,
	/// Selected hint value
	selectedValue: null,

	onClick(ev)
	{
		var hint, el=ev.target;

		do {
			hint = el.$hint;
			el= el.parentNode;
		} while (!hint && el);

		if (hint)
		{
			this.select(hint);
			this.doAccept();
		}
	},

	forceRequest()
	{
		ide.assist._requestHints(ide.editor, true);
	},

	clearHints(editor)
	{
		if (this.hints.length)
			this.hints = [];

		this.selected = this.selectedValue = null;
		this.calculateLeft(editor);
		this.debouncedHide();
		this.visibleStart = 0;

		ide.keymap.setUIState(null);
	},

	calculateLeft(editor)
	{
	var
		pos = this.pos = editor.token.current.getCoordinates(),
		// TODO ...
		bottom = pos.bottom + 200,
		viewHeight = window.innerHeight
	;
		this.isDown = bottom <= viewHeight;
		// TODO ?
		this.leftPos = Math.round(pos.left);
	},

	calculateTop()
	{
	var
		el = this.el, pos = this.pos,
		clientHeight = el.clientHeight,
		isDown = this.isDown,
		height = isDown ? pos.bottom : pos.top - clientHeight,
		translate = 'translate(' + this.leftPos + 'px,' + height + 'px)'
	;
		if (this.translateStr!==translate)
			this.el.style.transform = this.translateStr = translate;
	},

	addHints(hints)
	{
		var i = 0, l=hints.length;

		for (;i<l;i++)
			this.add(hints[i]);

		if (!this.visible)
			this.show(this.editor);

		this.render();
	},

	add(hint)
	{
		hint = hint instanceof ide.Hint ? hint : new ide.Hint(hint);
		this.hints.push(hint);
	},

	copyFont(el)
	{
		// TODO optimize?
		var style = window.getComputedStyle(el);
		this.el.style.fontFamily = style.fontFamily;
		this.el.style.fontSize = style.fontSize;
	},

	show()
	{
		if (!this.visible)
		{
			this.visibleStart = 0;
			this.visible = true;
			this.el.style.display='block';
			this.render();
		}
	},

	select(hint)
	{
		if (this.selected && this.selected!== hint)
			this.selected.el.classList.remove('selected');

		hint.el.classList.add('selected');

		this.selected = hint;
		this.selectedValue = hint.value;
	},

	renderHint(hint, i)
	{
		var el = hint.render();

		el.$hint = hint;
		hint.$index = i;

		ide.keymap.setUIState('inlineAssist');

		if (this.selectedValue === hint.value)
			this.select(hint);
		else
			el.classList.remove('selected');

		this.hintsContainer.appendChild(el);
	},

	hide()
	{
		ide.keymap.setUIState(null);

		if (this.visible)
		{
			this.el.style.display='none';
			this.hintsContainer.innerHTML = '';
			this.visible = false;
		}
	},

	sortFn(A, B)
	{
		return A.priority===B.priority ?
			(A.value>B.value ? 1 : -1) :
			(A.priority>B.priority ? 1 : -1);
	},

	sort()
	{
		return (this.hints = this.hints.sort(this.sortFn));
	},

	_renderDown(el, hints, i, l)
	{
		if (this.visibleStart>0)
			el.appendChild(this.scrollUpEl);

		for (; i<l; i++)
			this.renderHint(hints[i], i);

		if (this.visibleEnd<this.hints.length)
			el.appendChild(this.scrollDownEl);
	},

	_renderUp(el, hints, i, l)
	{
		if (this.visibleEnd<this.hints.length)
			el.appendChild(this.scrollUpEl);

		for (l--;l>=i; l--)
			this.renderHint(hints[l], l);

		if (this.visibleStart>0)
			el.appendChild(this.scrollDownEl);
	},

	_render()
	{
	var
		i = this.visibleStart,
		l = this.visibleEnd = i + this.visibleCount,
		el = this.hintsContainer,
		hints
	;
		if (l>this.hints.length)
			l = this.hints.length;
		if (l===0)
			return this.hide();

		this.debouncedHide.cancel();
		el.innerHTML = '';

		hints = this.sort();

		if (this.isDown)
			this._renderDown(el, hints, i, l);
		else
			this._renderUp(el, hints, i, l);

		this.calculateTop();

		if (!this.selected && this.hints.length)
			this.select(this.hints[this.visibleStart]);
	},

	_goNext(dir)
	{
	var
		selected = this.selected,
		index = selected.$index,
		diff = (this.isDown?1:-1) * (dir==='previousSibling' ? -1 : 1),
		nextIndex = index + diff,
		next = this.hints[nextIndex]
	;
		if (next)
		{
			if (nextIndex >= this.visibleEnd || nextIndex < this.visibleStart)
			{
				this.visibleStart += diff;
				this._render();
			}

			this.select(next);
		} else
			return ide.Pass;
	},

	/** Go to next suggestion */
	next()
	{
		const result = this._goNext();

		// TODO ?
		if (result===ide.Pass && ide.editor && ide.editor.cursor)
			ide.editor.cursor.goDown();
	},

	previous()
	{
		const result = this._goNext('previousSibling');

		if (result===ide.Pass && ide.editor && ide.editor.cursor)
			ide.editor.cursor.goUp();
	},

	doAccept()
	{
	var
		token = ide.assist.editor.token.current,
		value = this.selectedValue
	;
		if (value && token)
			token.replace(value);

		this.hide();
	},

	accept()
	{
		var token = ide.assist.editor.token.current;

		if (this.hints.length===0)
			return ide.Pass;

		if (this.selectedValue && token.cursorValue===this.selectedValue)
		{
			this.hide();
			// TODO returning false so it skips the uiState
			return false;
		}

		setTimeout(this.doAccept, this.delay);
	}

});

class AssistPanel {

	constructor()
	{
		this.el = document.getElementById('assist');
		this.el.innerHTML = '<div class="assist-perm"></div><div class="assist-hints"></div>';
		this.visible = false;

		this.$perm = this.el.children[0];
		this.$hints = this.el.children[1];
	}

	onItemClick()
	{
		if (this.action)
		{
			if (this.type==='ex')
				ide.commandBar.show(this.action);
			else
				ide.commandParser.run(this.action);
		}
	}

	clearHints()
	{
		this.$hints.innerHTML = '';
		this.hints = [];
		this.rendered = false;
	}

	hide()
	{
		document.body.appendChild(ide.logger.el);
		this.el.classList.remove('assist-show');
		this.visible = false;

		ide.workspace.el.classList.remove('assist-show');
		ide.hash.set({ a: false });
	}

	show()
	{
		this.el.classList.add('assist-show');
		this.el.insertBefore(ide.logger.el, this.$perm);
		this.visible = true;
		ide.workspace.el.classList.add('assist-show');
		ide.assist.requestHints();
		ide.hash.set({ a: 1 });
	}

	toggle()
	{
		return this.visible ? this.hide() : this.show();
	}

	sortedLastIndexBy(hint)
	{
		var l = this.hints.length;

		while (l--)
		{
			if (hint.priority > this.hints[l].priority)
				return l;
		}

		return 0;
	}

	addHint(hint)
	{
		if (this.rendered)
			this.renderHint(hint);
		else
			this.hints.push(hint);
	}

	renderHint(hint, i)
	{
		i = i===undefined ? this.sortedLastIndexBy(hint) : i;

		var ref = this.hints[i];
		var el = hint.render();

		if (ref && ref !== hint)
		{
			this.hints.splice(i, 0, hint);
			this.$hints.insertBefore(el, ref.el);
		} else
			this.$hints.appendChild(el);
	}

	appendHint(hint)
	{
		this.$hints.appendChild(hint.render());
	}

	render()
	{
		if (this.hints)
		{
			var hints = this.hints = cxl.sortBy(this.hints, 'priority');
			hints.forEach(this.appendHint, this);
		}

		this.rendered = true;
	}

}

class AssistRequest
{
	constructor(payload)
	{
		this.project = ide.project;
		this.payload = payload;
	}

	pluginData(plugin, data)
	{
		this.payload.plugins[plugin] = data;
	}

	supports(feature)
	{
		return feature in this.features;
	}

	respondExtended(hints)
	{
		ide.assist.onResponseExtended(this.$, hints);
	}

	respondInline(hints)
	{
		ide.assist.onResponseInline(this.$, hints);
	}
}

class Assist {

	constructor()
	{
		this.delay = 200;
		this.version = 0;
		this.assistData = { project: ide.project.id };

		this._debouncedRequest = cxl.debounce(this._requestHints, this.delay);

		this.panel = new AssistPanel();
		this.inline = new InlineAssist();
	}

	requestHints(editor, forceInline) {
		this._debouncedRequest(editor, forceInline);
	}

	/**
	 * Adds a hint at the top of the assist window that can only be removed
	 * manually by calling Hint#remove()
	 */
	addPermanentItem(item)
	{
		this.panel.$perm.appendChild(item.render());
	}

	cancel()
	{
		this.version++;
		this._debouncedRequest.cancel();
	}

	_doRequestNow(features)
	{
	var
		a = ide.assist,
		payload = a.assistData,
		req = new AssistRequest(payload)
	;
		req.editor = a.editor;
		payload.$ = req.$ = a.version;
		payload.editor = a.editor && a.editor.id;
		payload.extended = req.extended = a.panel.visible;
		payload.features = req.features = features;
		payload.plugins = {};

		ide.plugins.trigger('assist', req);

		ide.socket.send('assist', payload);

		a.panel.render();
	}

	_requestHints(editor, forceInline)
	{
		var token;

		editor = this.editor = editor || ide.editor;

		this.version++;
		this.panel.clearHints();

		if (editor)
		{
			token = editor.token && editor.token.current;

			if (token && (forceInline || token.cursorValue) &&
				(!editor.insert || editor.insert.enabled))
				this.inline.clearHints(editor);
			else
				this.inline.hide();

			editor.getAssistData().then(this._doRequestNow);
		} else
			this._doRequestNow({});
	}

	onResponseInline(version, hints)
	{
		if (/*version !== ide.assist.version || */!hints ||
			(ide.assist.editor.insert && !ide.assist.editor.insert.enabled))
			return;

		ide.assist.inline.addHints(hints);
	}

	/**
	 * @param hints {object|array} A Single hint or an array of hints.
	 */
	onResponseExtended(version, hints)
	{
		var me = ide.assist;

		if (/*version!==me.version ||*/ !me.panel.visible || !hints)
			return;

		if (Array.isArray(hints))
			hints.forEach(me.onResponseExtended.bind(me, version));
		else
		{
			var h = hints instanceof ide.Item ? hints : new ide.Item(hints);
			me.panel.addHint(h);
		}
	}

	onResponse(data)
	{
		/*if (data.$ !== this.version)
			return;*/
	var
		feature = this.editor[data.feature],
		method = feature && feature[data.method]
	;
		method.apply(feature, data.params);
	}

}

ide.plugins.register('assist', new ide.Plugin({

	core: true,

	commands: {
		assist: function() {
			ide.assist.panel.toggle();
		}
	},

	onAssist: function(request)
	{
		if (!request.extended)
			return;

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

		request.respondExtended(hints);
	},

	onExtended: function(data)
	{
		ide.assist.onResponseExtended(data.$, data.hints);
	},

	onInline: function(data)
	{
		ide.assist.onResponseInline(data.$, data.hints);
	},

	onSocket: function(data)
	{
		ide.assist.onResponse(data);
	},

	start: function()
	{
		ide.assist = new Assist();

		this.listenTo('token', this.onToken);
		this.listenTo('editor.focus', this.onToken);
		this.listenTo('file.write', this.onOther);
		this.listenTo('workspace.remove', this.onOther);
	},

	/**
	 * We use the editor provided, so plugins can override the current editor.
	 */
	onToken: function(editor)
	{
		ide.assist.requestHints(editor);
	},

	onOther: function()
	{
		ide.assist.requestHints();
	},

	ready: function()
	{
		ide.assist.addPermanentItem(ide.project.hint);

		this.listenTo('assist', this.onAssist);
		this.listenTo('socket.message.assist', this.onSocket);
		this.listenTo('socket.message.assist.inline', this.onInline);
		this.listenTo('socket.message.assist.extended', this.onExtended);

		if (ide.hash.data.a)
			ide.assist.panel.show();
	}

}));

ide.keymap.registerKeys({

	default: {
		'mod+space': 'assist.inlineForce'
	},

	inlineAssist: {

		// TODO change to 'assist.' prefix
		down: 'assist.inlineNext',
		up: 'assist.inlinePrevious',
		enter: 'assist.inlineAccept',
		//tab: 'assist.inlineAccept',
		esc: 'assist.inlineHide'

	}

});

})(this, this.ide, this.cxl, this._);
