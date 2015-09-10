
(function(window, ide, cxl, _) {
"use strict";

var Assist = cxl.View.extend({
	el: '#assist',
	visible: false,
	
	$hints: null,
	hints: null,
	
	initialize: function()
	{
		this.template = cxl.id('tpl-assist').innerHTML;
	},
	
	setup: function()
	{
		this.$hints = this.$el.find('.ide-assist-hints');
		this.$hints.on('click', 'button', this.onClick);
	},
	
	onClick: function(ev)
	{
	var
		action = ev.currentTarget.dataset.action,
		type = ev.currentTarget.dataset.type
	;
		if (action)
		{
			if (type==='ex')
				ide.commandBar.show(action);
			else
				ide.commandParser.run(action);
		}
	},
	
	hide: function()
	{
		this.$el.removeClass('ide-assist-show');
		this.visible = false;
		ide.workspace.$el.removeClass('ide-assist-show');
	},
	
	show: function()
	{
		this.$el.addClass('ide-assist-show');
		this.visible = true;
		ide.workspace.$el.addClass('ide-assist-show');
		this.requestHints();
	},
	
	requestHints: function()
	{
		this.$hints.empty();
		this.rendered = false;
		this.hints = [];
		ide.plugins.trigger('assist', this);	
		this.render();
	},
	
	toggle: function()
	{
		return this.visible ? this.hide() : this.show();
	},
	
	addHint: function(hint)
	{
		if (Array.isArray(hint))
			hint.forEach(this.addHint, this);
		else
			this.hints.push(hint);
	},
	
	renderHint: function(hint)
	{
		var key = ide.keyboard.findKey(hint.action);
		
		this.$hints.append('<button data-action="' + hint.action +
			'" data-type="' + hint.type + '"' +
			' class="ide-assist-hint ide-log">' +
			(key ? '<kbd>' + key + '</kbd>' : '') +
			(hint.action ? '<code>:' + hint.action + '</code> ' : '') +
			'<span>' + hint.hint + '</span></button>');
	},
	
	render: function()
	{
		var hints = this.hints = _.sortBy(this.hints, 'priority');
		
		hints.forEach(this.renderHint, this);
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
	
	onAssist: function(assist)
	{
		if (ide.project.id)
		{
			assist.addHint([
				{ hint: 'Open new file.', priority: 10, action: 'edit ', type: 'ex' },
				{ hint: 'List project files', priority: 10, action: 'find .'}
			]);
		} else
		{
			assist.addHint([
				{ hint: 'Open Project', priority: 10, action: 'project ' },
				{ hint: 'List Projects', priority: 10, action: 'projects' }
			]);
		}
		
		assist.addHint({
			hint: 'Documentation', priority: 10, action: 'help' });
	},
	
	start: function()
	{
		ide.assist = new Assist();
		ide.plugins.on('assist', this.onAssist, this);
	}
	
});
	
})(this, this.ide, this.cxl, this._);