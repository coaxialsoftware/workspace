
var
	workspace = require('./workspace')
;

class ServerResponse
{
	static respond(res, promise, module)
	{
		var r = new this(res, module);

		return r.respond(promise);
	}

	constructor(res, module)
	{
		this.res = res;
		this.module = module || workspace;
	}

	respond(promise)
	{
		Promise.resolve(promise)
			.then(this.$send.bind(this), this.$onError.bind(this));
	}

	$send(content)
	{
		this.res.send(content);
	}

	$onError(err)
	{
		this.module.error(err);
		this.res.status(500).send(err);
	}
}

module.exports = {
	ServerResponse: ServerResponse
};
