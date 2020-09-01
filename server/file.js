/*
 * workspace.file Module
 *
 * Events:
 *
 * - file.write
 * - file.beforewrite
 *
 */
'use strict';

const path = require('path').posix,
	plugin = (module.exports = cxl('workspace.file'));

plugin
	.config(function () {
		this.server = cxl('workspace').server;
	})
	.run(function () {
		ide.plugins.on('socket.message.file', this.onMessage.bind(this));
	})
	.extend({
		canAccess: function (filepath) {
			var full = path.resolve(filepath),
				root = ide.cwd;
			return full.indexOf(root) === 0;
		},

		loadFile: function (filepath, encoding) {
			filepath = path.normalize(filepath);
			var file = new ide.File(filepath);

			return this.canAccess(filepath)
				? file.read(encoding)
				: Promise.reject(
						new ide.Error('File cannot be accessed.', 403)
				  );
		},

		/**
		 * data.p    File path.
		 * data.t    File mtime.
		 */
		onMessageStat(client, data) {
			ide.File.stat(data.p).then(function (stat) {
				if (stat && !stat.isNew && stat.mtime.getTime() !== data.t) {
					ide.socket.respond(client, 'file', {
						stat: {
							p: data.p,
							t: stat.mtime.getTime(),
						},
					});
				}
			});
		},

		onMessage(client, data) {
			/* See if file has changed, and get contents if updated. */
			if (data.stat) this.onMessageStat(client, data.stat);
		},

		getFile(req) {
			var project = req.query.p,
				filename = req.query.n;
			return this.loadFile(path.join(project, filename || '')).then(
				function (file) {
					file.project = project;
					return file;
				}
			);
		},

		$checkChanged(mtime, file) {
			if (!file.stat.isNew && mtime !== file.stat.mtime.getTime())
				return Promise.reject('File contents have changed.');

			return file;
		},

		handleWrite(req, res) {
			if (!req.body) return res.status(400).end();

			ide.ServerResponse.respond(
				res,
				this.getFile(req)
					.then(file => this.$checkChanged(+req.query.t, file))
					.then(file => {
						this.log(`Writing "${file.path}" (${req.body.length})`);
						return file.write(req.body);
					})
					.then(file => this.sendFile(res, file)),
				this
			);
		},

		sendFile(res, file) {
			var stat = file.stat;

			res.setHeader('content-type', file.mime);
			res.setHeader('ws-file-stat', JSON.stringify(stat));
			res.setHeader('ws-file-path', file.path);

			// Normalized path relative to project
			// TODO try to remove this
			res.setHeader(
				'ws-file-name',
				path.normalize(path.relative(file.project, file.path))
			);

			return file.content;
		},
	})

	.route('GET', '/file', function (req, res) {
		ide.ServerResponse.respond(
			res,
			this.getFile(req).then(this.sendFile.bind(this, res)),
			this
		);
	})

	.route('DELETE', '/file', function (req, res) {
		ide.ServerResponse.respond(
			res,
			this.getFile(req)
				.then(this.$checkChanged.bind(this, +req.query.t))
				.then(file => file.delete())
				.then(this.sendFile.bind(this, res)),
			this
		);
	})

	.route('POST', '/file', 'handleWrite')
	.route('PUT', '/file', 'handleWrite');
