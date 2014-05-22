
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
		// Optional for basic authentication
		"user": "username",
		"password": "password",
		
		// Port to listen to
		"port": 9001,
		
		// Enable https
		"https": {
			cert: "certificate file",
			key: "key file"
		},
		
		// project.json defaults
		"default_settings": {
		}
	}


Define a Project (optional)
---------------------------

ide.js will look for values in package.json and use them to populate some of 
the project fields.

project.json

{
	"ignore": [ "files to ignore for autocompletion" ]
}

Startup
-------

From the workspace folder call bin/ide.js
