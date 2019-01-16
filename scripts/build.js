
const
	builder = require('@cxl/build'),

	SRC = [
		'client/core.js',
		c => `ide.version="${c.package.version}";`,
		'client/core.item.js',
		'client/core.editor.js',
		'client/core.plugins.js',
		'client/core.cmd.js',
		'client/core.keymap.js',
		'client/core.worker.js',
		'client/core.workspace.js',
		'client/core.socket.js',
		'client/core.diff.js',
		'client/core.file.js',
		'client/core.folder.js',
		'client/core.project.js',
		'client/core.bar.js',
		'client/core.source.js',
		'client/core.welcome.js',
		'client/core.assist.js'
	],

	LIBS = [
		'node_modules/codemirror/lib/codemirror.js',
		'node_modules/codemirror/addon/search/searchcursor.js',
		'node_modules/codemirror/addon/fold/xml-fold.js',
		'node_modules/codemirror/addon/edit/matchbrackets.js',
		'node_modules/codemirror/addon/edit/matchtags.js',
		'node_modules/codemirror/addon/edit/closetag.js',
		'node_modules/codemirror/addon/edit/closebrackets.js',
		'node_modules/codemirror/addon/comment/comment.js',
		'node_modules/codemirror/addon/comment/continuecomment.js',
		'node_modules/codemirror/addon/fold/foldcode.js',
		'node_modules/codemirror/addon/fold/foldgutter.js',
		'node_modules/codemirror/addon/fold/brace-fold.js',
		'node_modules/codemirror/addon/selection/active-line.js',
		'node_modules/codemirror/addon/mode/overlay.js',
		'node_modules/codemirror/mode/meta.js',
		'node_modules/codemirror/mode/javascript/javascript.js',
		'node_modules/codemirror/mode/xml/xml.js',
		'node_modules/codemirror/mode/htmlmixed/htmlmixed.js',
		'node_modules/codemirror/mode/css/css.js',
		'node_modules/codemirror/addon/mode/simple.js',

		'client/cm.find.js',
		'node_modules/xterm/dist/xterm.js',
		'node_modules/xterm/dist/addons/fit/fit.js'
	],
	CXL = [
		'node_modules/@cxl/ui/index.js',
		'node_modules/@cxl/ajax/index.js'
	]
;

builder.build({

	outputDir: 'public/build',
	targets: [
		{
			output: 'libs.js',
			src: [ ...LIBS ]
		},
		{
			output: 'debug.js',
			src: [
				'node_modules/@cxl/ui/debug.js',
				'node_modules/@cxl/ajax/index.js',
				...SRC,
				'client/debug.js'
			]
		},
		{
			output: 'ide.js',
			src: [ ...LIBS, ...CXL, ...SRC],
			minify: 'ide.min.js'
		},
		{
			output: 'docs.js',
			src: [
				'node_modules/@cxl/ui/index.js',
				'node_modules/@cxl/ui/icons.js',
				'node_modules/@cxl/ajax/index.js',
				'node_modules/@cxl/ui/router.js',
				'node_modules/@cxl/docs/dist/docs.js'
			]
		}
	]

});
