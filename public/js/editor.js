

window.addEventListener('load', function()
{
var
	editor = ace.edit('editor')
;
	editor.setTheme('ace/theme/twilight');
	editor.container.style.fontSize = '16px';
	editor.setKeyboardHandler('ace/keyboard/vim');

	editor.commands.addCommand({
		name: 'command',
		bindKey: ':',
		exec: function()
		{
			
		}
	});
});
