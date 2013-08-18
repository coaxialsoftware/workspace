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
				dest: 'public/js/ide.js'
			},
			css: {
				src: [
					'node_modules/j5ui/build/j5ui.css',
					'node_modules/j5ui/themes/silk/silk.css',
					'client/styles.css'
				],
				dest: 'public/ide.css'
			},
			libs: {
				src: [
					'node_modules/ace/build/src/ace.js',
					'node_modules/ace/build/src/theme-twilight.js',
					'node_modules/ace/build/src/keybinding-vim.js',
					'node_modules/j5ui/build/j5ui-all.js'
				],
				dest: 'public/js/libs.js'
			}
		},

		uglify: {
			client: {
				compress: true,
				files: { 'public/js/ide.js': 'public/js/ide.min.js' }
			}
		},

		watch: {
			client: {
				files: '<%= jshint.client.src %>',
				tasks: [ 'default:client' ]
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
