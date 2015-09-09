
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
		if (this.$hints===null)
			this.$hints = this.$el.find('.ide-assist-hints');
		
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
		this.$hints.append('<button class="ide-assist-hint ide-log">' +
			(hint.action ? '<code>' + hint.action + '</code> ' : '') +
			hint.hint + '</button>');
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
		if (ide.workspace.length===0)
		{
			assist.addHint([
				{ hint: 'Hello' },
				{ hint: 'It should techincally render HTML too' }
			]);
		} else
		{
			assist.addHint([
				{ hint: 'Open new file.', priority: 10, action: 'edit' },
				{ hint: 'Documentation', priority: 10, action: 'help' }
			]);
		}
	},
	
	start: function()
	{
		ide.assist = new Assist();
		ide.plugins.on('assist', this.onAssist, this);
	}
	
});
	
})(this, this.ide, this.cxl, this._);