(ide => {
	'use strict';

	class Hint {
		constructor(p) {
			this.priority = p.priority || 0;
			this.className = p.className || 'log';
			this.icon = p.icon;
			this.title = p.title || '';
			this.range = p.range;
			this.description = p.description;
			this.value = 'value' in p ? p.value : p.title;
			this.matchStart = p.matchStart;
			this.matchEnd = p.matchEnd;
		}

		render() {
			if (this.el === undefined) {
				this.$renderElements(this);
				this.$appendChildren();
			}

			return this.el;
		}

		$appendChildren() {
			var el = this.el;

			if (this.iconEl) el.appendChild(this.iconEl);
			if (this.titleEl) el.appendChild(this.titleEl);
			if (this.descEl) el.appendChild(this.descEl);
		}

		$renderIcon(obj) {
			this.iconEl = ide.resources.getIcon(obj.icon);
		}

		$renderDescription(obj) {
			var desc = (this.descEl = document.createElement(
				'ide-item-description'
			));

			if (obj.description) desc.innerHTML = obj.description;
		}

		// TODO do we need escaping?
		$renderTitle(obj) {
			var title = obj.title;

			if (obj.matchStart !== undefined) {
				title =
					title.slice(0, obj.matchStart) +
					'<b>' +
					title.slice(obj.matchStart, obj.matchEnd) +
					'</b>' +
					title.slice(obj.matchEnd);
			}

			if (!this.titleEl)
				this.titleEl = document.createElement('ide-item-title');

			this.titleEl.innerHTML = title;
		}

		$renderElements(obj) {
			var el = (this.el = document.createElement('ide-item'));
			el.tabIndex = 0;
			el.className = 'item ' + obj.className;
			el.$item = this;

			if (obj.icon) this.$renderIcon(obj);
			if (obj.description) this.$renderDescription(obj);
			if (obj.title) this.$renderTitle(obj);
		}

		remove() {
			if (this.el && this.el.parentNode)
				this.el.parentNode.removeChild(this.el);
		}

		destroy() {}
	}

	class Item extends Hint {
		/**
		 * Options:
		 * key
		 * className
		 * action
		 * value
		 * code
		 */
		constructor(p) {
			super(p);

			this.key = p.key;
			this.action = p.action;
			this.code = p.code;
			this.tags = p.tags;

			if (p.enter) this.enter = p.enter;
		}

		$renderTags(obj) {
			if (this.tagsEl) this.tagsEl.innerHTML = '';
			var el =
					this.tagsEl ||
					(this.tagsEl = document.createElement('ide-item-tags')),
				tags = obj.tags,
				tag,
				i;
			for (i in tags) {
				if (tags[i]) {
					tag = document.createElement('ide-tag');
					tag.innerHTML = tags[i];
					el.appendChild(tag);
				}
			}
		}

		$renderIcons(icons) {
			return (
				'<div class="icons">' +
				icons.map(this.$renderIcon).join('') +
				'</div>'
			);
		}

		$renderKey(obj) {
			if (!obj.key && obj.action) {
				var key = ide.keyboard.findKey(obj.action);
				obj.key = key ? key : ':' + obj.action;
			}

			if (!this.keyEl) this.keyEl = document.createElement('kbd');
			this.keyEl.innerHTML = obj.key || '';
		}

		$renderCode(obj) {
			this.codeEl = document.createElement('code');
			this.codeEl.innerHTML = obj.code || '';
		}

		$renderElements(obj) {
			super.$renderElements(obj);

			if (obj.key || obj.action) this.$renderKey(obj);
			if (obj.code) this.$renderCode(obj);
			if (obj.tags) this.$renderTags(obj);
		}

		$appendChildren() {
			var el = this.el;

			if (this.tagsEl) el.appendChild(this.tagsEl);
			if (this.codeEl) el.appendChild(this.codeEl);
			if (this.iconEl) el.appendChild(this.iconEl);
			if (this.titleEl) el.appendChild(this.titleEl);
			if (this.keyEl) el.appendChild(this.keyEl);
			if (this.descEl) el.appendChild(this.descEl);
		}

		/**
		 * Search algorithm. Match by title.
		 * TODO Should we match by description or tags?
		 */
		matches(regex) {
			return regex.test(this.title);
		}
	}

	class DynamicItem extends Item {
		$renderElements(obj) {
			var el = (this.el = document.createElement('ide-item'));
			el.tabIndex = 0;
			el.className = 'item ' + obj.className;

			this.$renderIcon(obj);
			this.$renderDescription(obj);
			this.$renderTitle(obj);
			this.$renderKey(obj);
			this.$renderCode(obj);
			this.$renderTags(obj);
		}

		$renderIcon(obj) {
			var el;

			if (obj.$icon) {
				el = ide.resources.getIcon(obj.$icon);

				if (this.iconEl) {
					this.el.insertBefore(el, this.iconEl);
					this.el.removeChild(this.iconEl);
				} else this.iconEl = el;
			} else this.iconEl = document.createElement('span');
		}

		get icon() {
			return this.$icon;
		}
		set icon(val) {
			if (this.$icon !== val) {
				this.$icon = val;
				this.$renderIcon(this);
			}
		}

		get key() {
			return this.$key;
		}
		set key(val) {
			this.$key = val;
			if (this.keyEl) this.keyEl.innerHTML = val || '';
		}

		get action() {
			return this.$action;
		}
		set action(val) {
			this.$action = val;
			if (this.keyEl) this.$renderKey(this);
		}

		get title() {
			return this.$title;
		}
		set title(val) {
			this.$title = val;
			if (this.titleEl) this.$renderTitle(this);
		}

		get code() {
			return this.$code;
		}
		set code(val) {
			this.$code = val;
			if (this.codeEl) this.codeEl.innerHTML = val || '';
		}

		get description() {
			return this.$description;
		}
		set description(val) {
			this.$description = val;
			if (this.descEl) this.descEl.innerHTML = val || '';
		}

		get tags() {
			return this.$tags;
		}
		set tags(val) {
			if (this.$tags !== val) {
				this.$tags = val;
				this.$renderTags(this);
			}
		}

		get className() {
			return this.$className;
		}
		set className(val) {
			if (this.$className !== val) {
				this.$className = val;
				if (this.el) this.el.className = 'item ' + (val || 'log');
			}
		}
	}

	class ComponentItem {
		constructor(component) {
			this.component = component;
		}

		render() {
			return (this.el = this.component);
		}

		matches(regex) {
			var state = this.component.$view.state,
				i,
				prop;

			for (i in state) {
				prop = state[i];

				if (typeof prop === 'string' && regex.test(state[i]))
					return true;
			}
		}

		destroy() {}
	}

	class Notification extends Item {
		/** Optional Id for progress hints */
		//id: null,

		/**
		 * If present hint will persist until progress becomes 1.
		 * Progress from 0.0 to 1.0. A value of -1 will show a spinner
		 */
		//progress: null,

		constructor(message, kls) {
			if (typeof message === 'string')
				message = { title: message, className: kls };

			super(message);

			this.id = message.id;
			this.progress = message.progress;
		}
	}

	class Logger {
		constructor() {
			this.active = {};
			this.items = [];
			this.el = document.getElementById('notification');
			this.delay = 3000;
		}

		remove(item) {
			// Item has already been removed ?
			if (item.el.parentNode !== this.el) return;

			if (item.id) delete this.active[item.id];

			this.el.removeChild(item.el);
			this.items.unshift(item);
			if (this.items.length > 100) this.items.length = 100;
		}

		notify(span) {
			if (span.id) {
				var old = span.id && this.active[span.id];

				if (old) this.remove(old);

				this.active[span.id] = span;
			}

			const el = span.render();

			this.el.insertBefore(el, this.el.firstChild);

			if (
				span.progress === null ||
				span.progress === undefined ||
				span.progress === 1
			)
				setTimeout(this.remove.bind(this, span), this.delay);

			return span;
		}
	}

	Object.assign(ide, {
		Logger: Logger,
		Item: Item,
		DynamicItem: DynamicItem,
		ComponentItem: ComponentItem,
		Notification: Notification,
		Hint: Hint,
	});
})(this.ide);
