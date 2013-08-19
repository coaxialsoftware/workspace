module.exports = function(grunt) {

	grunt.initConfig({

		jshint: {
			client: {
				options: { jshintrc: 'client/.jshintrc' },
				src: [
					'client/loader.js',
					'client/editor.js',
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
			client: {
				src: '<%= jshint.client.src %>',
				dest: 'public/build/ide.js'
			},
			css: {
				src: [
					'node_modules/j5ui/build/j5ui.css',
					'node_modules/j5ui/themes/silk/silk.css',
					'client/styles.css'
				],
				dest: 'public/build/ide.css'
			},
			libs: {
				src: [
					'node_modules/ace/build/src/ace.js',
					'node_modules/ace/build/src/theme-twilight.js',
					'node_modules/ace/build/src/keybinding-vim.js',

					'node_modules/j5ui/build/j5ui-all.js',

				],
				dest: 'public/build/libs.js'
			},

			tern: {
				src: [
					'node_modules/tern/node_modules/acorn/acorn.js',
					'node_modules/tern/node_modules/acorn/acorn_loose.js',
					'node_modules/tern/node_modules/acorn/util/walk.js',
					'node_modules/tern/lib/signal.js',
					'node_modules/tern/lib/tern.js',
					'node_modules/tern/lib/def.js',
					'node_modules/tern/lib/jsdoc.js',
					'node_modules/tern/lib/infer.js'
				],
				dest: 'public/build/tern.js'
			}
		},

		uglify: {
			client: {
				compress: true,
				files: { 'public/build/ide.min.js': 'public/build/ide.js' }
			},
			libs: {
				compress: true,
				files: { 'public/build/libs.min.js': 'public/build/libs.js' }
			}
		},

		watch: {
			client: {
				files: '<%= jshint.client.src %>',
				tasks: [ 'jshint:client', 'concat:client' ]
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
