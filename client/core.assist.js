
(function(window, ide, cxl) {
"use strict";

var Assist = cxl.View.extend({
	el: '#assist',
	visible: false,
	
	initialize: function()
	{
		this.template = cxl.id('tpl-assist').innerHTML;
		ide.plugins.on('notify', this.onNotify, this);
	},
	
	onNotify: function(msg, kls, el, timeout)
	{
		if (this.visible)
		{
			clearTimeout(timeout);
			this.$el.find('.ide-assist-notify').prepend(el);
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
	},
	
	toggle: function()
	{
		return this.visible ? this.hide() : this.show();
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
		var assist = this.assist || (this.assist = new Assist());

		assist.toggle();
	}
	
});
	
})(this, this.ide, this.cxl);