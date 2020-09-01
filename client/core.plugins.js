((ide, cxl) => {
	'use strict';

	class EventEmitter {
		on(type, callback, scope) {
			return this.addEventListener(type, callback, scope);
		}
		off(type, callback, scope) {
			return this.removeEventListener(type, callback, scope);
		}
		addEventListener(type, callback, scope) {
			if (!this.__handlers) this.__handlers = {};
			if (!this.__handlers[type]) this.__handlers[type] = [];
			this.__handlers[type].push({ fn: callback, scope: scope });
			return { unsubscribe: this.off.bind(this, type, callback, scope) };
		}
		removeEventListener(type, callback, scope) {
			const handlers = this.__handlers && this.__handlers[type];
			if (!handlers) throw new Error('Invalid arguments');
			const h =
					handlers &&
					handlers.find(h => h.fn === callback && h.scope === scope),
				i = handlers.indexOf(h);
			if (i === -1) throw new Error('Invalid listener');
			handlers.splice(i, 1);
		}
		$eachHandler(type, fn) {
			if (this.__handlers && this.__handlers[type])
				this.__handlers[type].slice(0).forEach(handler => {
					try {
						fn(handler);
					} catch (e) {
						if (type !== 'error') this.trigger('error', e);
						else throw e;
					}
				});
		}
		emit(type, ...args) {
			this.$eachHandler(type, handler =>
				handler.fn.call(handler.scope, ...args)
			);
		}
		emitAndCollect(type, ...args) {
			const result = [];
			this.$eachHandler(type, handler =>
				result.push(handler.fn.call(handler.scope, ...args))
			);
			return result;
		}
		trigger(type, ...args) {
			return this.emit(type, ...args);
		}
		once(type, callback, scope) {
			const subscriber = this.on(type, (...args) => {
				subscriber.unsubscribe();
				return callback.call(scope, ...args);
			});
		}
	}

	/**
	 *
	 * Main Plugin class for all plugins.
	 *
	 */
	class Plugin {
		constructor(p) {
			cxl.extend(this, p);
			this.__resources = [];
		}

		/** @type {string} Plugin Name */
		//name: null,

		/** If key is pressed, invoke function will be called. */
		//shortcuts: null,
		/** Editor Commands */
		//editorCommands: null,
		/// Object of commands to add to ide.commands
		//commands: null,

		/// Runs when all plugins are initialized @type {function}
		//ready: null,

		/**
		 * Starts Plugin when all other plugins are loaded.
		 * @param settings Settings specified in the project. The name of the plugin will be used.
		 */
		start() {}

		/**
		 * Saves or retrieves local storage data
		 */
		data(prop, value) {
			prop = 'ide.plugin.' + this.name + '.' + prop;

			if (arguments.length === 1) return window.localStorage[prop];

			try {
				if (value !== undefined) window.localStorage[prop] = value;
				else window.localStorage.removeItem(prop);
			} catch (e) {
				ide.notify(e.message, 'error');
			}
		}

		/**
		 * Register resources to be destroyed when reloading.
		 */
		resources() {
			for (var i = 0; i < arguments.length; i++)
				this.__resources.push(arguments[i]);
		}

		/**
		 * Adds event handler.
		 */
		listenTo(name, fn) {
			this.resources(ide.plugins.on(name, fn, this));
			return this;
		}

		listenToElement(el, name, fn) {
			this.resources(new cxl.EventListener(el, name, fn));
		}

		/**
		 * Unbinds all event handlers and destroys plugin
		 */
		destroy() {
			this.__resources.forEach(r => (r.unsubscribe || r.destroy)());
			ide.plugins.unregister(this);
		}
	}

	class PluginManager extends EventEmitter {
		constructor() {
			super();

			this._plugins = {};
			this.started = false;
			this.source = null;

			this.on('socket.message.plugins', this.onSocket, this);
			// TODO should we keep this here?
			window.addEventListener('focus', ev =>
				this.emit('workspace.focus', ev)
			);
		}

		onSocket(data) {
			if (data.refresh)
				ide.notify({
					code: 'core',
					className: 'warn',
					title: 'Plugins updated. Please refresh',
				});
		}

		reload() {
			if (!this.started) return;

			cxl.ajax.get('plugins/source').then(source => {
				/* jshint evil:true */
				cxl.each(this._plugins, function (p) {
					if (!p.core) p.destroy();
				});

				new Function(source).call();
				this.start();
				this.ready();
			});
		}

		get(name) {
			return this._plugins[name];
		}

		/**
		 * Iterates through plugins and stops if fn returns true.
		 */
		each(fn) {
			for (var i in this._plugins) {
				var result = fn.bind(this)(this._plugins[i], i);

				if (result) return result;
			}
		}

		/**
		 * Finds best editor for current file. options.file must be a ide.File.
		 */
		findPlugin(options) {
			return (
				this.each(function (plug) {
					return plug.open && plug.open(options);
				}) || ide.defaultEdit(options)
			);
		}

		loadPlugin(plug, name) {
			if (this.started && plug.core) return;

			try {
				if (plug.start) plug.start(ide.project[name]);

				this.registerCommands(plug);

				if (plug.shortcuts) this.registerShortcuts(plug);
			} catch (e) {
				window.console.error(e);
				ide.error('Error loading plugin "' + name + '"');
			}
		}

		ready() {
			this.each(function (plug) {
				if (this.started && plug.core) return;
				try {
					if (plug.ready) plug.ready();
				} catch (e) {
					window.console.error(e);
				}
			});

			this.started = true;
		}

		start() {
			var src = (this.source = ide.project.get('plugins.src'));

			if (src) ide.source(src);

			this.each(this.loadPlugin);
		}

		/**
		 * Register commands and editor commands
		 */
		registerCommands(plugin) {
			for (var i in plugin.commands)
				plugin.resources(
					ide.registerCommand(i, plugin.commands[i], plugin)
				);

			for (i in plugin.editorCommands)
				plugin.resources(
					ide.registerEditorCommand(
						i,
						plugin.editorCommands[i],
						plugin
					)
				);
		}

		/**
		 * Registers new keymap shortcuts
		 */
		registerShortcuts(plugin) {
			ide.keymap.registerKeys(plugin.shortcuts, plugin);
		}

		/**
		 * Registers a new plugin
		 */
		register(name, plugin) {
			if (!(plugin instanceof ide.Plugin))
				plugin = new ide.Plugin(plugin);

			this._plugins[name] = plugin;
			plugin.name = name;
		}

		unregister(plug) {
			// TODO
			delete this._plugins[plug.name];
		}
	}

	function versionToFloat(ver) {
		const n = ver.split('.');
		return n[0] * 100000 + n[1] * 1000 + n[2];
	}

	var PluginComponent = cxl.component(
		{
			name: 'ide-plugin-item',
			bindings: 'ide.on(project.load):#render =data:#render',
			attributes: ['data'],
			template: `
<link rel="stylesheet" href="styles.css" />
<ide-item class="item">
<ide-item-tags><template &="=tags:each:repeat"><ide-tag &="item:text"></ide-tag></template>
</ide-item-tags><code &="=code:text"></code><ide-item-title &="=title:|text">
</ide-item-title><ide-item-description &="=description:show:text"></ide-item-description>
<ide-item-footer &="=local:hide">
<span>
<cxl-submit &="=installed:hide on(click):#install =loadInstall:@disabled">Install</cxl-submit>
<cxl-submit &="=installed:show on(click):#uninstall =loadInstall:@disabled">Uninstall</cxl-submit>
<span>
</ide-item-footer></ide-item>`,
		},
		class {
			render() {
				var tags = (this.tags = []),
					a = this.data,
					version = versionToFloat(a.version),
					npmVersion;
				if (a.installed) tags.push('Installed');
				if (a.unofficial) tags.push('Unofficial');
				if (a.local) tags.push('Local');

				if (a.npmVersion) {
					npmVersion = versionToFloat(a.npmVersion);

					if (version < npmVersion) tags.push('Update Available');
					else if (version > npmVersion)
						tags.push('NPM: ' + a.npmVersion);
				}

				this.code = a.name.slice(15);
				this.title = a.name + ' ' + a.version;
				this.description = a.description;
				this.installed = a.installed;
				this.version = a.version;
			}

			post(url) {
				var me = this;

				return cxl.ajax
					.post(url, {
						project: ide.project.id,
						id: this.code,
					})
					.then(
						function (res) {
							me.data = res;
						},
						function (er) {
							ide.error(er);
						}
					)
					.then(function () {
						me.loadInstall = false;
					});
			}

			install() {
				this.loadInstall = true;
				return this.post('/plugins/install');
			}

			uninstall() {
				this.loadInstall = true;
				return this.post('/plugins/uninstall');
			}

			enable() {
				this.loadEnable = true;
				this.post('/plugins/enable');
			}

			disable() {
				this.loadEnable = true;
				this.post('/plugins/disable');
			}
		}
	);

	/**
	 * Plugin Manager
	 * @type {ide.PluginManager}
	 */
	ide.plugins = new PluginManager();
	ide.Plugin = Plugin;
	ide.PluginComponent = PluginComponent;

	cxl.directive('ide.on', {
		connect() {
			this.bindings = [
				ide.plugins.on(this.parameter, this.set.bind(this)),
			];
		},
	});
})(this.ide, this.cxl);
