
(function(ide, cxl) {
"use strict";
	
var LoginDialog = ide.Editor.extend({
	
	templateUrl: 'tpl/login',
	
	_setup: function()
	{
		this.$el.html(cxl.id(this.templateUrl).innerHTML);
		
		this.listenTo(this.$el.find('form'), 'submit', this.submit);
	},
	
	submit: function(ev)
	{
		ide.socket.send('online', {
			u: this.$el.find('[name="username"]').val(),
			p: this.$el.find('[name="password"]').val()
		});
		
		ev.preventDefault();
	}
});
	
ide.plugins.register('online', {
	
	open: function()
	{
		var editor = new LoginDialog({
			plugin: this
		});
		
		ide.workspace.add(editor);
	},
	
	commands: {
		login: function()
		{
			this.open();
		}
	}

});
	
})(this.ide, this.cxl);