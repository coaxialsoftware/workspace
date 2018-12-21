(ide => {
"use strict";

const
	trigger = ide.plugins.trigger,
	events$ = new cxl.rx.BehaviorSubject()
;

class TokenEditor extends ide.SourceEditor {

	// TODO figure a better way to disable token feature.
	loadFeatures(p)
	{
		delete this.constructor.features().token;
		return super.loadFeatures(p);
	}

	render(p)
	{
		super.render(p);

		this.listenTo(ide.plugins, 'token', this.onToken);
	}

	onToken(editor, token)
	{
		var json;

		try {
			json = JSON.stringify(token, null, 4);
		} catch(e)
		{
			json = 'Error stringifying token';
		}

		this.editor.setValue(json);
	}

}


ide.plugins.trigger = function(type, a, b, c) {
	events$.next({
		type: type, a: a, b: b, c: c
	});
	return trigger.call(this, type, a, b, c);
};

class DebugEvents extends ide.ListEditor {

	render(p)
	{
		super.render(p);

		this.bindings.push(
			events$.subscribe(ev => {
				this.add([{ title: ev.type }]);
			})
		);
	}

}

var loadPlugin = ide.plugins.loadPlugin;

ide.plugins.loadPlugin = function(plug, name) {

	window.console.log(`Loading Plugin ${name}`);
	loadPlugin.call(this, plug, name);

};


ide.plugins.register('debug', {

	icon: 'bug',
	core: true,

	onProjectLoad()
	{
		window.console.log('Project configuration was updated.');
	},

	ready()
	{
		this.listenTo('project.load', this.onProjectLoad);
	},

	commands: {

		'debug.token': {
			fn()
			{
				var file = new ide.File();
				file.mime = 'application/json';
				return new TokenEditor({
					plugin: this,
					file: file
				});
			},
			description: 'Show current token',
			icon: 'bug'
		},

		'debug.stats': {
			fn()
			{
			},
			icon: 'bug'
		},

		'debug.inspect': {
			fn()
			{
			var
				loc = window.location,
				inspect = ide.project.get('debug.inspect'),
				url
			;
				if (!inspect)
					return ide.warn('Inspect not enabled.');

				url = window.encodeURI(loc.hostname + ':' +
					ide.project.get('debug.inspect') + '/node');

				window.console.log('chrome-devtools://devtools/remote/serve_file/' +
					'@521e5b7e2b7cc66b4006a8a54cb9c4e57494a5ef/inspector.ht' +
					'ml?experiments=true&v8only=true&ws=' + url
				);
			},
			description: 'Inspect node server (must be run with --inspect flag)',
			icon: 'bug'
		},

		'debug.tests': {
			fn() { window.open('/client'); },
			icon: 'bug'
		},

		'debug.events': {
			fn() {
				const editor = new DebugEvents({
					command: 'debug.events'
				});

				return editor;
			}
		},

		'debug.benchmark': {
			fn() { window.open('/client/benchmark.html'); },
			icon: 'bug'
		},

		'debug.diff': {

			fn()
			{
				var newfile = new ide.File();

				ide.open({ file: newfile }).then(function(editor) {
					editor.plugin = this;
					editor.command = 'debug.diff';
					editor.listenTo(ide.plugins, 'editor.change', function(e) {
						if (editor===e)
							return;

						var file = e.file;
						editor.file.content = JSON.stringify(file.diff(), null, 2);
						editor.file.update();
					});
					editor.cmd('insert.disable');
				});
			},
			description: 'Show File Diff for current editor',
			icon: 'bug'
		}
	}

});


})(this.ide);