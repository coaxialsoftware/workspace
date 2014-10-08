
ide.js
======

Node JS lean vim-based editor for the web. 

Installation
------------

	npm install
	bower install
	grunt minify

Global Settings
---------------

~/.ide.js/config.json

Whatever is in this file will be the template for project.json


Define a Workspace (optional)
-----------------------------

workspace.json

	{
		// Optional for basic authentication.
		"user": "username",
		"password": "password",
		
		// Port to listen to
		"port": 9001,
		
		// Enable https
		"https": {
			cert: "certificate file",
			key: "key file"
		},
		
		// project.json default settings. See project.json for details.
		"default_settings": {
		}
	}


Define a Project (optional)
---------------------------

ide.js will look for values in package.json and use them to populate some of 
the project fields.

project.json

{
	"ignore": Regex | Array of file names
		Files to ignore. If an Array is passed, it will be converted to a regex.
		
	// Default Editor Settings
	"editor": {
		// Theme name from available ace themes.
		"theme": "ace/theme/twilight"
		
		// Editor font size
		"font_size: "16px",
		
		// Keyboard bindings
		"bindings": "ace/keyboard/vim",
		
		// Show indentation guides
		"indent_guides": false,
		
		// Use hard tabs "tab" or spaces "space"
		"indent_style": "tab",
		
		// A whole number defining the number of columns used 
		// for each indentation level and the width of soft tabs
		"indent_size": 4,
		
	}
}

Startup
-------

From the workspace folder call node bin/ide.js

Commands
--------

Press ":" in normal mode to get the command bar.

e
	Open File
tabe
	Open File in new Tab
q
	Quit
