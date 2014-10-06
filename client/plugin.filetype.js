
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
		php: 'php',
		php5: 'php',
		py: 'python',
		r: 'r',
		ru: 'ruby',
		rb: 'ruby',
		sh: 'sh',
		bash: 'sh',
		rhtml: 'rhtml',
		txt: 'text'
	},
	modeByFile= {
		Rakefile: 'ruby'
	}
;

	ide.filetype = function(file)
	{
	var
		f = file.attributes,
		mode = modeByFile[f.filename] ||
			modeByMime[f.mime] ||
			modeByExt[f.ext] ||
			f.mime.split('/')[1]
	;
		return mode;
	};

})(this.ide, this._);