
workspace
=========

A new IDE concept based on web technologies with a focus on
extensibility and user experience.

The editor main features are:

- Easy to install and configure. Runs locally or remotely.
- Client/Server based. Client handles rendering, while server handles the heavy tasks.
- A Plugin API. Plugins can be enabled by project or by workspace.
- A simplistic yet powerful UI.

Dependencies
------------

- node >3.0 and npm.
- A modern web browser.

Installation
------------

To install from npm (stable)

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
	
or download it to a folder and:

	cd folder
	npm link
	
You can also manually load it using the "plugins"
property of workspace.json.

	{
		// Install the plugin
		"plugins": [ "file:path" ]
		
		// Load it for all projects
		"project" { "plugins": [ "name" ] },
	}
	
In order to use the plugin you must load it by adding it to the workspace, see example above,
or by using the project.json file:
	
	{
		"plugins": [ "plugin name", "plugin2" ]
	}

- 