Plugin Guidelines
=================

Naming
------

Plugins must be named after the tool or functionality they
introduce. If the plugin introduces many new features. It should be split into individual plugins.

File Structure
--------------

Projects must include the following files:

	index.js
	package.json
	
index.js must define a cxl Module and export it.

	module.export = cxl('workspace.name');

Plugins may include javascript to be executed in the client by using the module's "source" or "sourcePath" property.

Plugins should use the editor CSS and avoid introducing new classes.

Source Code
-----------

Plugins must follow the main project JSHINT rules. 100% test coverage is recommended.

Plugins should not depend on other plugins.