
(function(window, ide, cxl, _) {
"use strict";
	
ide.Hint = function ideHint(p)
{
	_.extend(this, p);
	
	if (this.action)
		this.key = ide.keyboard.findKey(this.action);
};

_.extend(ide.Hint.prototype, {
	
	/** Hint element */
	el: null,
	
	priority: 10,
	
	/** Shortcut */
	key: null,
	
	type: 'log',
	
	onClick: function()
	{
		if (this.action)
		{
			if (this.type==='ex')
				ide.commandBar.show(this.action);
			else
				ide.commandParser.run(this.action);
		}
	},
	
	render: function()
	{
	var
		el = this.el = document.createElement('BUTTON'),
		hint = this, key = this.key
	;
		el.type = 'button';
		el.className = 'ide-assist-hint ide-' + this.type;
		el.addEventListener('click', this.onClick.bind(this));
		el.innerHTML = (key ? '<kbd>' + key + '</kbd>' : '') +
			(hint.tag ? '<code>' + hint.tag + '</code>' : '') +
			(hint.action ? '<code>:' + hint.action + '</code> ' : '') +
			'<span>' + hint.hint + '</span>';
		
		return el;
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
	
	$hints: null,
	hints: null,
	
	initialize: function()
	{
		this.template = cxl.id('tpl-assist').innerHTML;
		this.requestHints = _.debounce(this._requestHints, this.delay);
		this.listenTo(ide.plugins, 'token', this.onToken);
		this.listenTo(ide.plugins, 'editor.focus', this.onToken);
		this.listenTo(ide.plugins, 'workspace.remove_child', this.onToken);
	},
	
	onToken: function()
	{
		this.editor = ide.editor;
		this.token = this.editor.token;
		this.requestHints();
	},
	
	hide: function()
	{
		cxl.$body.append(ide.$notifications);
		this.$el.removeClass('ide-assist-show');
		this.visible = false;
		ide.workspace.$el.removeClass('ide-assist-show');
		ide.workspace.hash.set({ a: false });
	},
	
	show: function()
	{
		this.$el.addClass('ide-assist-show');
		this.el.insertBefore(ide.$notifications, this.$hints);
		this.visible = true;
		ide.workspace.$el.addClass('ide-assist-show');
		this._requestHints();
		ide.workspace.hash.set({ a: 1 });
	},
	
	_requestHints: function()
	{
		if (!this.visible)
			return;
		
		this.version++;
		this.$hints.innerHTML = '';
		this.rendered = false;
		this.hints = [];
		
		ide.plugins.trigger('assist',
			this.addHint.bind(this, this.version), this.editor, this.token);
		
		ide.socket.send('assist',
			{ version: this.version, file: _.get(this.editor, 'file.id'), token: this.token });
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
			if (this.rendered)
				this.renderHintOrder(h);
			else
				this.hints.push(h);
		}
	},
	
	renderHintOrder: function(hint)
	{
	var
		i = _.sortedIndex(this.hints, hint, 'priority'),
		el = hint.render(),
		ref = this.hints[i].el
	;
		this.hints.splice(i, 0, hint);
		this.$hints.insertBefore(el, ref);
	},
	
	renderHint: function(hint)
	{
		this.$hints.appendChild(hint.render());
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
			hints.push({ hint: 'Documentation', action: 'help' });
		
			if (ide.project.id)
			{
				hints.push([
					{ hint: 'Open new file.', action: 'edit ', type: 'ex' },
					{ hint: 'List project files', action: 'find'}
				]);
			} else
			{
				hints.push([
					{ hint: 'Open Project', action: 'project ' },
					{ hint: 'List Projects', action: 'projects' }
				]);
			}
		}
		
		done(hints);
	},
	
	onSocket: function(data)
	{
		ide.assist.addHint(data.version, data.hints);
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