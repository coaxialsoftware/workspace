
(function(ide) {
"use strict";

var
	modeByMime= {
		"text/plain": "text"
	},
	modeByExt= {
		ch: 'csharp',
		c: 'c_cpp',
		cc: 'c_cpp',
		cpp: 'c_cpp',
		cxx: 'c_cpp',
		h: 'c_cpp',
		hh: 'c_cpp',
		hpp: 'c_cpp',
		clj: 'clojure',
		js: 'javascript',
		json: 'json',
		less: 'less',
		md: 'markdown',
		css: 'css',
		php: 'php',
		php5: 'php',
		py: 'python',
		r: 'r',
		ru: 'ruby',
		rb: 'ruby',
		sh: 'sh',
		sql: 'sql',
		bash: 'sh',
		html: 'html',
		rhtml: 'rhtml',
		txt: 'text'
	},
	modeByFile= {
		Rakefile: 'ruby',
		'.gitignore': 'gitignore'
	}
;

	ide.filetype = function(file)
	{
	var
		f = file.attributes,
		mode = modeByFile[f.filename] ||
			modeByMime[f.mime] ||
			modeByExt[f.ext] ||
			'plain_text'
	;
		return mode;
	};

})(this.ide, this._);