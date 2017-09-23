
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
		var theme = this.themes[path] || this.register(path, new ide.Theme(path));
		return theme.source ? Promise.resolve(theme) : theme.load();
	}

}

ide.themes = new ThemeManager();
