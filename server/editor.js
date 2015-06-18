
/*	find_projects: function()
	{
	var
		files = fs.readdirSync(this.config.path + '/'),
		projects = {},
		i,
		path
	;
		for (i=0; i<files.length;i++)
		{
			path = files[i];

			if (!fs.statSync(path).isDirectory())
				continue;

			projects[path] = {
				path: path,
				package: common.load_json_sync(path+'/package.json'),
				project: common.load_json_sync(path+'/project.json')
			};

			this.find_tags(projects[path]);
		}

		return projects;
	},
	*/
