
const
	builder = require('@cxl/build'),
	CSS = [
		'node_modules/codemirror/lib/codemirror.css',
		'node_modules/codemirror/addon/fold/foldgutter.css',
		'node_modules/xterm/dist/xterm.css',
		'client/styles.css',
		'public/theme/default.css'
	]
;

builder.build({
	outputDir: 'public',
	targets: [
		{
			output: 'debug.html',
			src: [
				'client/html/debug.html',
				...CSS,
				'client/html/body.html', 'client/html/templates.html'
			]
		},
		{
			output: 'styles.css',
			src: [
				'client/styles.css',
				'public/theme/default.css'
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
