
const
	builder = require('@cxl/build')
;

builder.build({
	outputDir: 'public',
	targets: [
		{
			output: 'debug.html',
			src: [
				'client/html/debug.html', 'public/build/ide.css',
				'client/html/body.html', 'client/html/templates.html'
			]
		},
		{
			output: 'index.html',
			src: [
				'client/html/index.html', 'public/build/ide.css',
				'client/html/body.html', 'client/html/templates.html'
			]
		}
	]
});
