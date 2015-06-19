module.exports = function(grunt) {

	grunt.initConfig({

		path: {
			ace: "bower_components/ace-builds/src",
			backbone: "bower_components/backbone",
			lodash: "bower_components/lodash",
			jquery: "bower_components/jquery"
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
					'client/styles.css'
				],
				dest: 'public/build/ide.css'
			},

			libs: {
				src: [
					'<%= path.ace %>/ace.js',
					'<%= path.ace %>/mode-javascript.js',
					'<%= path.ace %>/mode-html.js',
					'<%= path.ace %>/mode-css.js',

					'<%= path.ace %>/theme-twilight.js',
					'<%= path.ace %>/keybinding-vim.js',

					'<%= path.jquery %>/dist/jquery.js',
					'<%= path.lodash%>/lodash.js',
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
