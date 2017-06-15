
var
	path = require('path'),
	workspace = require('./workspace'),
	common = require('./common'),
	Q = Promise
;

class Theme
{
	constructor(p)
	{
		this.path = path.isAbsolute(p) ? p :
			workspace.basePath + '/public/theme/' + p + '.css';

		workspace.watch(this.path, this.onWatch.bind(this));
	}

	onWatch()
	{
		this.load().then(function() {
			workspace.plugins.emit('themes.reload:' + this.path, this);
		});
	}

	toJSON()
	{
		return this.source;
	}

	load()
	{
		return common.read(this.path).bind(this).then(function(src)
		{
			this.source = src.replace(/\n/g,'');

			return this;
		});
	}

}

class ThemeManager
{
	constructor()
	{
		this.themes = {};
	}

	/**
	 * Use this function to register a new Theme
	 */
	register(path, theme)
	{
		return (this.themes[path] = theme);
	}

	load(path)
	{
		var theme = this.themes[path] || this.register(path, new Theme(path));
		return theme.source ? Q.resolve(theme) : theme.load();
	}

}

workspace.Theme = Theme;
workspace.themes = new ThemeManager();