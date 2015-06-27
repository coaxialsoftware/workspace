module.exports = function(grunt) {

	grunt.initConfig({

		path: {
			ace: "node_modules/ace-builds/src",
			backbone: "node_modules/backbone",
			lodash: "node_modules/lodash",
			jquery: "node_modules/jquery"
		},

		jshint: {
			client: {
				options: { jshintrc: 'client/.jshintrc' },
				src: [
					'client/loader.js',
					'client/editor.js',
					'client/workspace.js',
					'client/commands.js',
					'client/plugin*.js'
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
					'node_modules/codemirror/addon/lint/lint.css',
					'node_modules/codemirror/theme/twilight.css',
					'client/styles.css'
				],
				dest: 'public/build/ide.css'
			},

			libs: {
				src: [
					/*'<%= path.ace %>/ace.js',
					'<%= path.ace %>/mode-javascript.js',
					'<%= path.ace %>/mode-html.js',
					'<%= path.ace %>/mode-css.js',

					'<%= path.ace %>/theme-twilight.js',
					'<%= path.ace %>/keybinding-vim.js',
					*/
					'node_modules/codemirror/lib/codemirror.js',
					'node_modules/codemirror/addon/search/searchcursor.js',
					'node_modules/codemirror/addon/search/search.js',
					'node_modules/codemirror/addon/edit/matchbrackets.js',
					'node_modules/codemirror/addon/edit/matchtags.js',
					'node_modules/codemirror/addon/edit/closetag.js',
					'node_modules/codemirror/addon/edit/closebrackets.js',
					'node_modules/codemirror/addon/comment/comment.js',
					'node_modules/codemirror/addon/fold/foldcode.js',
					'node_modules/codemirror/addon/fold/foldgutter.js',
					'node_modules/codemirror/addon/fold/brace-fold.js',
					'node_modules/codemirror/addon/lint/lint.js',
					'node_modules/codemirror/addon/selection/active-line.js',
					'node_modules/codemirror/keymap/vim.js',
					/*
					'node_modules/codemirror/addon/hint/show-hint.js',
					'node_modules/codemirror/addon/hint/javascript-hint.js',
					'node_modules/codemirror/addon/hint/html-hint.js',
					'node_modules/codemirror/addon/hint/css-hint.js',
					*/
					'node_modules/codemirror/addon/lint/javascript-lint.js',
					'node_modules/codemirror/addon/lint/json-lint.js',
					'node_modules/codemirror/mode/javascript/javascript.js',
					
					'node_modules/codemirror/mode/htmlmixed/htmlmixed.js',
					
					'node_modules/codemirror/addon/lint/css-lint.js',
					'node_modules/codemirror/mode/css/css.js',

					'<%= path.jquery %>/dist/jquery.js',
					'<%= path.lodash%>/index.js',
					'<%= path.backbone %>/backbone.js',
					'node_modules/cxl/dist/cxl.js'
				],
				dest: 'public/build/libs.js'
			},

			client: {
				src: [ '<%=concat.libs.dest %>', '<%= jshint.client.src %>' ],
				dest: 'public/build/ide.js'
			},

			debug: {
				src: '<%= jshint.client.src %>',
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
				tasks: [ 'jshint:client', 'concat:client', 'concat:debug' ]
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
		}

	});

	grunt.loadNpmTasks('grunt-contrib-clean');
	grunt.loadNpmTasks('grunt-contrib-concat');
	grunt.loadNpmTasks('grunt-contrib-watch');
	grunt.loadNpmTasks('grunt-contrib-uglify');
	grunt.loadNpmTasks('grunt-contrib-jshint');

	grunt.registerTask('default', [ 'jshint', 'concat' ]);
	grunt.registerTask('minify', [ 'default', 'uglify' ]);
};
