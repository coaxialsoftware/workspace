
(function(window, ide, cxl, _) {
"use strict";
	
ide.Hint = ide.Item.extend({
	
	priority: 10,
	
	/** Shortcut */
	key: null,
	
	/** "assist" or "inline" */
	type: 'assist',
	
	className: 'log',
	
	initialize: function()
	{
		if (!this.key && this.action)
		{
			var key = ide.keyboard.findKey(this.action);
			this.key = key ? key : ':' + this.action;
		}
	}

});
	
var InlineAssist = function() {
	this.hints = [];
	this.el = document.createElement('DIV');
	this.el.setAttribute('id', 'assist-inline');
	this.debouncedShow = _.debounce(this.show.bind(this));
	this.cursor = { line: 0, ch: 0 };
	
	window.document.body.appendChild(this.el);
};
	
_.extend(InlineAssist.prototype, {
	
	hints: null,
	visible: false,
	
	add: function(hint)
	{
		if (this.visible)
			this.renderHint(hint);
		else
			this.hints.push(hint);
		
		this.debouncedShow();
	},
	
	clear: function()
	{
		if (this.hints.length)
			this.hints = [];
	},
	
	show: function(editor)
	{
		editor = editor || ide.editor;
		this.cursor.line = editor.token.line;
		this.cursor.ch = editor.token.start;
	var
		pos = editor && editor.getCursorCoordinates &&
			editor.getCursorCoordinates(this.cursor),
		style = this.el.style
	;
		if (pos)
		{
			this.el.innerHTML = '';
			style.top = Math.round(pos.bottom) + 'px';
			style.left = Math.round(pos.left) + 'px';
			
			if (!this.visible)
			{
				style.display='block';
				this.visible = true;
				this.render();
			}
		}
	},
	
	renderHint: function(hint, order)
	{
		order = order===undefined ?
			_.sortedIndex(this.hints, hint, 'priority') :
			order
		;
		
		var ref = this.hints[order];
		
		if (ref && ref !== hint)
		{
			this.hints.splice(order, 0, hint);
			this.el.insertBefore(hint.el, ref.el);
		}
		else
			this.el.appendChild(hint.el);
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
	delay: 500,
	
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
		this.listenTo(ide.plugins, 'file.write', this.onToken);
		this.listenTo(ide.plugins, 'workspace.remove', this.onToken);
		
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
	
	onToken: function()
	{
		this.requestHints();
	},
	
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
	
	_requestHints: function()
	{
	var
		editor = ide.editor,
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
		if (!this.visible || version!==this.version)
			return;
		
		if (Array.isArray(hints))
			hints.forEach(this.addHint.bind(this, version));
		else
		{
			var h = hints instanceof ide.Hint ? hints : new ide.Hint(hints);
			
			if (h.type==='inline')
				this.inline.add(h);
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