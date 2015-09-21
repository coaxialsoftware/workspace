module.exports = function(grunt) {

	grunt.initConfig({

		jshint: {
			client: {
				options: { jshintrc: 'client/.jshintrc' },
				src: [
					'client/core.js',
					'client/core.keymap.js',
					'client/core.cmd.js',
					'client/core.plugins.js',
					'client/core.workspace.js',
					'client/core.socket.js',
					'client/core.file.js',
					'client/core.project.js',
					'client/core.bar.js',
					'client/core.source.js',
					'client/core.folder.js',
					'client/core.online.js',
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
					'public/theme/twilight.css',
					'client/styles.css'
				],
				dest: 'public/build/ide.css'
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
					'node_modules/codemirror/addon/lint/lint.js',
					'node_modules/codemirror/addon/selection/active-line.js',
					'node_modules/codemirror/addon/mode/overlay.js',
					/*
					'node_modules/codemirror/addon/hint/show-hint.js',
					'node_modules/codemirror/addon/hint/javascript-hint.js',
					'node_modules/codemirror/addon/hint/html-hint.js',
					'node_modules/codemirror/addon/hint/css-hint.js',
					*/
					'node_modules/codemirror/addon/lint/javascript-lint.js',
					'node_modules/codemirror/addon/lint/json-lint.js',
					'node_modules/codemirror/mode/meta.js',
					'node_modules/codemirror/mode/javascript/javascript.js',
					'node_modules/codemirror/mode/xml/xml.js',
					
					'node_modules/codemirror/mode/htmlmixed/htmlmixed.js',
					
					'node_modules/codemirror/addon/lint/css-lint.js',
					'node_modules/codemirror/mode/css/css.js',

					'node_modules/@cxl/cxl/dist/cxl.js'
				],
				dest: 'public/build/libs.js'
			},

			client: {
				src: [ '<%=concat.libs.dest %>', '<%= jshint.client.src %>' ],
				dest: 'public/build/ide.js'
			},

			debug: {
				src: [ 'node_modules/@cxl/cxl/client/cxl-debug.js', '<%= jshint.client.src %>' ],
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
				tasks: [ 'jshint:client', 'concat:client', 'concat:debug', 'karma' ]
			},
			
			client_tests: {
				files: [ 'test/client.js', 'test/client/*.js' ],
				tasks: [ 'karma' ]
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
				browsers: [ 'PhantomJS' ],
				reporters: [ 'progress', 'coverage' ],
				background: true,
				singleRun: false,
				coverageReporter: {
					subdir: 'report'
				}
			},

			client: {
				plugins: [
					'karma-qunit', 'karma-coverage', 'karma-phantomjs-launcher'
				],
				files: [
					{ src: [
						'test/polyfill.js',
						'public/build/libs.js',
						'node_modules/jquery-mockjax/dist/jquery.mockjax.js',
						'test/client.js',
						'<%= jshint.client.src %>'
					]},
					{ src: 'test/client/*.js' }
				],
				preprocessors: {
					'client/**/*.js': [ 'coverage' ]
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
	grunt.loadNpmTasks('grunt-contrib-clean');
	grunt.loadNpmTasks('grunt-contrib-concat');
	grunt.loadNpmTasks('grunt-contrib-watch');
	grunt.loadNpmTasks('grunt-contrib-uglify');
	grunt.loadNpmTasks('grunt-contrib-jshint');
	grunt.loadNpmTasks('grunt-contrib-copy');

	grunt.registerTask('default', [ 'jshint', 'concat' ]);
	grunt.registerTask('publish', [ 'default', 'copy', 'uglify' ]);
};
