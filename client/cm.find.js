// CodeMirror, copyright (c) by Marijn Haverbeke and others
// Distributed under an MIT license: http://codemirror.net/LICENSE

// Define find commands. Depends on searchcursor.
// implementation of the openDialog method.

(function(mod) {
  if (typeof exports == "object" && typeof module == "object") // CommonJS
    mod(require("../../lib/codemirror"), require("./searchcursor"));
  else if (typeof define == "function" && define.amd) // AMD
    define(["../../lib/codemirror", "./searchcursor" ], mod);
  else // Plain browser env
    mod(CodeMirror);
})(function(CodeMirror) {
  "use strict";
  function searchOverlay(query, caseInsensitive) {

    return {
	  token: function(stream) {
      query.lastIndex = stream.pos;
      var match = query.exec(stream.string);
      if (match && match.index == stream.pos) {
        stream.pos += match[0].length;
        return "searching";
      } else if (match) {
        stream.pos = match.index;
      } else {
        stream.skipToEnd();
      }
    }};
  }

  function SearchState() {
    this.query = this.replace = this.options = this.from = this.to = this.found = null;
  }

  function find(query, options)
  {
    var state = this.getSearchState();

    state.query = query;
    state.options = options;

    return this.findNext(options);
  }

  function findCursor(cm, options)
  {
    var state = cm.getSearchState();

    state.found = state.from = state.to = null;

    if (state.query)
    {
      var cursor = cm.getSearchCursor(state.query, cm.getCursor());

      if (options && 'forward' in options)
        options.backwards = options.forward===false;

      if (!cursor.find(options && options.backwards))
      {
        cursor = cm.getSearchCursor(state.query, {
          line: options && options.backwards ? cm.lastLine() : 0,
          ch: 0
        });

        if (!cursor.find(options && options.backwards)) return state;
      }

      state.found = true;
      state.from = cursor.from();
      state.to = cursor.to();
    }

    return state;
  }

  function moveCursor(cm, from, to, options)
  {
    cm.setCursor(options && options.backwards ? from : { line: to.line, ch: to.ch-1});
    cm.scrollIntoView({from: from, to: to }, 60);
  }

  function findNext(options)
  {
    var state = findCursor(this, options);

    if (state.found)
      moveCursor(this, state.from, state.to, options);

    return state;
  }

  function getSearchState()
  {
    return this.state.search || (this.state.search = new SearchState());
  }

  function replaceRange(cm, pattern, str, options)
  {
  var
  	text = cm.getRange(options.from, options.to, options.separator),
    replace
  ;
    if (typeof(pattern)==='string')
      pattern = new RegExp(pattern, 'g');

    replace = text.replace(pattern, str);

    if (text !== replace)
      cm.replaceRange(replace, options.from, options.to);
  }

  /**
   * Options:
   *
   * forward: true|false
   * backwards: true|false
   * from: Position
   * to: Position. Used to replace a range.
   * separator: Used as line separator for range replace.
   */
  function replace(pattern, str, options)
  {
    if (options && options.from && options.to)
      return replaceRange(this, pattern, str, options);

    var state = pattern ? this.find(pattern, options) : this.findNext(options);

    if (str || typeof(str)==='string')
      state.replace = str;

    if (state.found)
      this.replaceRange(String(state.replace), state.from, state.to);
  }

  CodeMirror.defineExtension('find', find);
  CodeMirror.defineExtension('findNext', findNext);
  CodeMirror.defineExtension('replace', replace);
  CodeMirror.defineExtension('getSearchState', getSearchState);

  CodeMirror.commands.findNext = function(cm) { cm.findNext(); };
  CodeMirror.commands.findPrev = function(cm) { cm.findNext({ backwards: true }); };

});