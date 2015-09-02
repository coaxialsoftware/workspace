
workspace
=========

Lean and fast browser based IDE. 

Dependencies
------------

- iojs >3.0 and npm.
- A modern web browser.

Installation
------------

To install from npm

	npm -g install @cxl/workspace

To install from source

	git clone https://github.com/coaxialsoftware/workspace.git
	cd workspace
	npm link
	
To install from github

	npm -g install coaxialsoftware/workspace
	
Plugins
-------

Install plugins using npm.

	npm -g install @cxl/workspace.plugin
	
or

	cd folder
	npm link
	
You can also download it to a folder and manually load it using the "plugins"
property of workspace.json

	{
		// Install the plugin
		"plugins": [ "file:path" ]
		
		// Load it for all projects
		"project" { "plugins": [ "name" ] },
	}
	
In order to use the plugin you must load it using the plugins property of the project.json file 
	
	{
		"plugins": [ "plugin name", "plugin2" ]
	}
