module.exports = function(grunt) {

	process.env.CHROME_BIN = 'chromium-browser';

	grunt.initConfig({

		jshint: {
			client: {
				options: { jshintrc: 'client/.jshintrc' },
				src: [
					'client/core.js',
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
				]
			},
			server: {
				options: { jshintrc: 'server/.jshintrc' },
				src: [ 'server/*.js' ]
			}
		},

		concat: {

			css: {
				src: [
					'node_modules/codemirror/lib/codemirror.css',
					'node_modules/codemirror/addon/fold/foldgutter.css',
					'node_modules/xterm/dist/xterm.css',
					'client/styles.css',
					'public/theme/default.css'
				],
				dest: 'public/build/ide.css'
			},

			docs: {
				src: [
					'node_modules/highlight.js/lib/highlight.js',
					'node_modules/highlight.js/lib/languages/bash.js',
					'node_modules/highlight.js/lib/languages/javascript.js',

					'node_modules/@cxl/cxl/client/cxl.js',
					'node_modules/@cxl/cxl/shared/cxl-util.js',
					'node_modules/@cxl/cxl/shared/cxl-rx.js',
					'node_modules/@cxl/cxl/client/cxl-dom.js',
					'node_modules/@cxl/cxl/client/cxl-dom-css.js',
					'node_modules/@cxl/cxl/client/cxl-template.js',
					'node_modules/@cxl/cxl/client/cxl-ui-theme.js',
					'node_modules/@cxl/cxl/client/cxl-ui.js',
					'node_modules/@cxl/cxl/client/cxl-router.js'
				],
				dest: 'public/docs/docs.js'
			},

			docsCss: {
				src: [
					'node_modules/highlight.js/styles/zenburn.css'
				],
				dest: 'public/docs/docs.css'
			},

			test: {
				src: 'node_modules/jquery-mockjax/dist/jquery.mockjax.js',
				dest: 'public/build/test.js'
			},

			libs: {
				src: [
					'node_modules/codemirror/lib/codemirror.js',
					'node_modules/codemirror/addon/search/searchcursor.js',
					'node_modules/codemirror/addon/search/find.js',
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

					'node_modules/xterm/dist/xterm.js',
					'node_modules/xterm/dist/addons/fit/fit.js',

					'node_modules/@cxl/cxl/client/cxl.js',
					'node_modules/@cxl/cxl/shared/cxl-util.js',
					'node_modules/@cxl/cxl/shared/cxl-rx.js',
					'node_modules/@cxl/cxl/client/cxl-dom.js',
					'node_modules/@cxl/cxl/client/cxl-dom-css.js',
					'node_modules/@cxl/cxl/client/cxl-template.js',
					'node_modules/@cxl/cxl/client/cxl-ui-theme.js',
					'node_modules/@cxl/cxl/client/cxl-ui.js',
					'node_modules/@cxl/cxl/client/cxl-validity.js',
					'node_modules/@cxl/cxl/client/cxl-ajax.js',
					'node_modules/@cxl/cxl/client/cxl-legacy.js'
				],
				dest: 'public/build/libs.js'
			},

			client: {
				src: [ '<%=concat.libs.dest %>', '<%= jshint.client.src %>' ],
				dest: 'public/build/ide.js'
			},

			debug: {
				src: [ '<%= jshint.client.src %>', 'client/debug.js' ],
				dest: 'public/build/debug.js'
			},

			html: {
				src: [
					'client/html/index.html', 'public/build/ide.css',
					'client/html/body.html', 'client/html/templates.html'
				],
				dest: 'public/index.html'
			},

			htmldbg: {
				src: [
					'client/html/debug.html', 'public/build/ide.css',
					'client/html/body.html', 'client/html/templates.html'
				],
				dest: 'public/debug.html'
			}

		},

		uglify: {
			client: {
				compress: true,
				files: { 'public/build/ide.min.js': 'public/build/ide.js' }
			}
		},

		watch: {
			client: {
				files: [ '<%= jshint.client.src %>' ],
				tasks: [ 'jshint:client', 'concat:client', 'concat:debug', 'karma:client' ]
			},

			client_tests: {
				files: [ 'test/client.js', 'test/client/*.js' ],
				tasks: [ 'karma:client' ]
			},

			libs: {
				files: '<%=concat.libs.src %>',
				tasks: [ 'concat:libs' ]
			},

			server: {
				files: '<%= jshint.server.src %>',
				tasks: 'jshint:server'
			},

			css: {
				files: '<%= concat.css.src %>',
				tasks: [ 'concat:css' ]
			},

			html: {
				files: [ '<%= concat.html.src %>', 'client/html/debug.html' ],
				tasks: [ 'concat:html', 'concat:htmldbg' ]
			}
		},

		karma: {

			options: {
				frameworks: [ 'qunit' ],
				browsers: [ 'ChromeHeadless' ],
				reporters: [ 'progress', 'coverage' ],
				background: false,
				singleRun: true,
				coverageReporter: {
					subdir: 'report',
					type: 'lcov'
				}
			},

			client: {
				plugins: [
					'karma-qunit', 'karma-coverage', 'karma-chrome-launcher'
				],
				files: [
					{ src: [
						'public/build/libs.js',
						'test/client/boot.js',
						'<%= jshint.client.src %>',
						'test/client/mock.js'
					]},
					{ src: 'test/client/core.js' },
					{ src: 'test/client/core.item.js' },
					{ src: 'test/client/core.editor.js' },
					{ src: 'test/client/core.cmd.js' },
					{ src: 'test/client/core.file.js'},
					{ src: 'test/client/core.folder.js' },
					{ src: 'test/client/core.diff.js' }
				],
				proxies: {
					'/file': 'http://localhost:9004/file',
					'/project': 'http://localhost:9004/project'
				},

				preprocessors: {
					'client/*.js': [ 'coverage' ]
				}
			}
		},

		copy: {
			codemirror: {
				files: [
					{
						expand: true,
						cwd: 'node_modules/codemirror/mode',
						src: '**/*.js',
						dest: 'public/mode'
					}
				]
			},

			fonts: {
				files: [
					{
						expand: true,
						flatten: true,
						src: 'node_modules/font-awesome/fonts/*',
						dest: 'public/fonts/'
					},
					{
						expand: true,
						flatten: true,
						src: 'node_modules/font-awesome/css/font-awesome.min.css',
						dest: 'public/build'
					}
				]
			}
		}

	});

	grunt.loadNpmTasks('grunt-karma');
	grunt.loadNpmTasks('grunt-contrib-concat');
	grunt.loadNpmTasks('grunt-contrib-jshint');
	grunt.loadNpmTasks('grunt-contrib-copy');

	grunt.registerTask('default', [ 'jshint', 'concat' ]);
	grunt.registerTask('publish', [ 'default', 'copy' ]);
};
