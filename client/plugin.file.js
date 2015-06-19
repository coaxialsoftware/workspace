/**
 * workspace.file
 */

(function(cxl, ide) {
"use strict";

ide.File = cxl.Model.extend({

	idAttribute: 'path',

	initialize: function()
	{
		this.on('error', this._onError);
	},

	_onSync: function()
	{
		this.trigger('write');
		ide.trigger('write', this);
		ide.notify('File ' + this.id + ' saved.');
	},

	_onError: function(file, res)
	{
	var
		msg = (res && (res.responseJSON && res.responseJSON.error) ||
			res.responseText) || 'Error saving file: ' + this.id
	;
		ide.error(msg);
	},

	save: function()
	{
		ide.trigger('beforewrite', this);
		cxl.Model.prototype.save.call(this, null, {
			success: this._onSync.bind(this)
		});
	},

	isNew: function()
	{
		return this.attributes.new;
	},

	parse: function(response)
	{
		response.ext = /(?:\.([^.]+))?$/.exec(response.path)[1];
		return response;
	},

	url: function()
	{
	var
		mtime = Date.now()
	;
		return '/file?p=' + this.get('project') +
			'&n=' + this.get('filename') + '&t=' + mtime;
	},

	toString: function()
	{
		return this.get('filename') || '';
	}

});


})(this.cxl, this.ide);