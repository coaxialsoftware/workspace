/*
Syntax highlighting with language autodetection.
https://highlightjs.org/
*/

(function(factory) {

  // Find the global object for export to both the browser and web workers.
  var globalObject = typeof window === 'object' && window ||
                     typeof self === 'object' && self;

  // Setup highlight.js for different environments. First is Node.js or
  // CommonJS.
  if(typeof exports !== 'undefined') {
    factory(exports);
  } else if(globalObject) {
    // Export hljs globally even when using AMD for cases when this script
    // is loaded with others that may still expect a global hljs.
    globalObject.hljs = factory({});

    // Finally register the global hljs with AMD.
    if(typeof define === 'function' && define.amd) {
      define([], function() {
        return globalObject.hljs;
      });
    }
  }

}(function(hljs) {
  // Convenience variables for build-in objects
  var ArrayProto = [],
      objectKeys = Object.keys;

  // Global internal variables used within the highlight.js library.
  var languages = {},
      aliases   = {};

  // Regular expressions used throughout the highlight.js library.
  var noHighlightRe    = /^(no-?highlight|plain|text)$/i,
      languagePrefixRe = /\blang(?:uage)?-([\w-]+)\b/i,
      fixMarkupRe      = /((^(<[^>]+>|\t|)+|(?:\n)))/gm;

  var spanEndTag = '</span>';

  // Global options used when within external APIs. This is modified when
  // calling the `hljs.configure` function.
  var options = {
    classPrefix: 'hljs-',
    tabReplace: null,
    useBR: false,
    languages: undefined
  };


  /* Utility functions */

  function escape(value) {
    return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function tag(node) {
    return node.nodeName.toLowerCase();
  }

  function testRe(re, lexeme) {
    var match = re && re.exec(lexeme);
    return match && match.index === 0;
  }

  function isNotHighlighted(language) {
    return noHighlightRe.test(language);
  }

  function blockLanguage(block) {
    var i, match, length, _class;
    var classes = block.className + ' ';

    classes += block.parentNode ? block.parentNode.className : '';

    // language-* takes precedence over non-prefixed class names.
    match = languagePrefixRe.exec(classes);
    if (match) {
      return getLanguage(match[1]) ? match[1] : 'no-highlight';
    }

    classes = classes.split(/\s+/);

    for (i = 0, length = classes.length; i < length; i++) {
      _class = classes[i]

      if (isNotHighlighted(_class) || getLanguage(_class)) {
        return _class;
      }
    }
  }

  function inherit(parent) {  // inherit(parent, override_obj, override_obj, ...)
    var key;
    var result = {};
    var objects = Array.prototype.slice.call(arguments, 1);

    for (key in parent)
      result[key] = parent[key];
    objects.forEach(function(obj) {
      for (key in obj)
        result[key] = obj[key];
    });
    return result;
  }

  /* Stream merging */

  function nodeStream(node) {
    var result = [];
    (function _nodeStream(node, offset) {
      for (var child = node.firstChild; child; child = child.nextSibling) {
        if (child.nodeType === 3)
          offset += child.nodeValue.length;
        else if (child.nodeType === 1) {
          result.push({
            event: 'start',
            offset: offset,
            node: child
          });
          offset = _nodeStream(child, offset);
          // Prevent void elements from having an end tag that would actually
          // double them in the output. There are more void elements in HTML
          // but we list only those realistically expected in code display.
          if (!tag(child).match(/br|hr|img|input/)) {
            result.push({
              event: 'stop',
              offset: offset,
              node: child
            });
          }
        }
      }
      return offset;
    })(node, 0);
    return result;
  }

  function mergeStreams(original, highlighted, value) {
    var processed = 0;
    var result = '';
    var nodeStack = [];

    function selectStream() {
      if (!original.length || !highlighted.length) {
        return original.length ? original : highlighted;
      }
      if (original[0].offset !== highlighted[0].offset) {
        return (original[0].offset < highlighted[0].offset) ? original : highlighted;
      }

      /*
      To avoid starting the stream just before it should stop the order is
      ensured that original always starts first and closes last:

      if (event1 == 'start' && event2 == 'start')
        return original;
      if (event1 == 'start' && event2 == 'stop')
        return highlighted;
      if (event1 == 'stop' && event2 == 'start')
        return original;
      if (event1 == 'stop' && event2 == 'stop')
        return highlighted;

      ... which is collapsed to:
      */
      return highlighted[0].event === 'start' ? original : highlighted;
    }

    function open(node) {
      function attr_str(a) {return ' ' + a.nodeName + '="' + escape(a.value).replace('"', '&quot;') + '"';}
      result += '<' + tag(node) + ArrayProto.map.call(node.attributes, attr_str).join('') + '>';
    }

    function close(node) {
      result += '</' + tag(node) + '>';
    }

    function render(event) {
      (event.event === 'start' ? open : close)(event.node);
    }

    while (original.length || highlighted.length) {
      var stream = selectStream();
      result += escape(value.substring(processed, stream[0].offset));
      processed = stream[0].offset;
      if (stream === original) {
        /*
        On any opening or closing tag of the original markup we first close
        the entire highlighted node stack, then render the original tag along
        with all the following original tags at the same offset and then
        reopen all the tags on the highlighted stack.
        */
        nodeStack.reverse().forEach(close);
        do {
          render(stream.splice(0, 1)[0]);
          stream = selectStream();
        } while (stream === original && stream.length && stream[0].offset === processed);
        nodeStack.reverse().forEach(open);
      } else {
        if (stream[0].event === 'start') {
          nodeStack.push(stream[0].node);
        } else {
          nodeStack.pop();
        }
        render(stream.splice(0, 1)[0]);
      }
    }
    return result + escape(value.substr(processed));
  }

  /* Initialization */

  function expand_mode(mode) {
    if (mode.variants && !mode.cached_variants) {
      mode.cached_variants = mode.variants.map(function(variant) {
        return inherit(mode, {variants: null}, variant);
      });
    }
    return mode.cached_variants || (mode.endsWithParent && [inherit(mode)]) || [mode];
  }

  function compileLanguage(language) {

    function reStr(re) {
        return (re && re.source) || re;
    }

    function langRe(value, global) {
      return new RegExp(
        reStr(value),
        'm' + (language.case_insensitive ? 'i' : '') + (global ? 'g' : '')
      );
    }

    function compileMode(mode, parent) {
      if (mode.compiled)
        return;
      mode.compiled = true;

      mode.keywords = mode.keywords || mode.beginKeywords;
      if (mode.keywords) {
        var compiled_keywords = {};

        var flatten = function(className, str) {
          if (language.case_insensitive) {
            str = str.toLowerCase();
          }
          str.split(' ').forEach(function(kw) {
            var pair = kw.split('|');
            compiled_keywords[pair[0]] = [className, pair[1] ? Number(pair[1]) : 1];
          });
        };

        if (typeof mode.keywords === 'string') { // string
          flatten('keyword', mode.keywords);
        } else {
          objectKeys(mode.keywords).forEach(function (className) {
            flatten(className, mode.keywords[className]);
          });
        }
        mode.keywords = compiled_keywords;
      }
      mode.lexemesRe = langRe(mode.lexemes || /\w+/, true);

      if (parent) {
        if (mode.beginKeywords) {
          mode.begin = '\\b(' + mode.beginKeywords.split(' ').join('|') + ')\\b';
        }
        if (!mode.begin)
          mode.begin = /\B|\b/;
        mode.beginRe = langRe(mode.begin);
        if (!mode.end && !mode.endsWithParent)
          mode.end = /\B|\b/;
        if (mode.end)
          mode.endRe = langRe(mode.end);
        mode.terminator_end = reStr(mode.end) || '';
        if (mode.endsWithParent && parent.terminator_end)
          mode.terminator_end += (mode.end ? '|' : '') + parent.terminator_end;
      }
      if (mode.illegal)
        mode.illegalRe = langRe(mode.illegal);
      if (mode.relevance == null)
        mode.relevance = 1;
      if (!mode.contains) {
        mode.contains = [];
      }
      mode.contains = Array.prototype.concat.apply([], mode.contains.map(function(c) {
        return expand_mode(c === 'self' ? mode : c)
      }));
      mode.contains.forEach(function(c) {compileMode(c, mode);});

      if (mode.starts) {
        compileMode(mode.starts, parent);
      }

      var terminators =
        mode.contains.map(function(c) {
          return c.beginKeywords ? '\\.?(' + c.begin + ')\\.?' : c.begin;
        })
        .concat([mode.terminator_end, mode.illegal])
        .map(reStr)
        .filter(Boolean);
      mode.terminators = terminators.length ? langRe(terminators.join('|'), true) : {exec: function(/*s*/) {return null;}};
    }

    compileMode(language);
  }

  /*
  Core highlighting function. Accepts a language name, or an alias, and a
  string with the code to highlight. Returns an object with the following
  properties:

  - relevance (int)
  - value (an HTML string with highlighting markup)

  */
  function highlight(name, value, ignore_illegals, continuation) {

    function subMode(lexeme, mode) {
      var i, length;

      for (i = 0, length = mode.contains.length; i < length; i++) {
        if (testRe(mode.contains[i].beginRe, lexeme)) {
          return mode.contains[i];
        }
      }
    }

    function endOfMode(mode, lexeme) {
      if (testRe(mode.endRe, lexeme)) {
        while (mode.endsParent && mode.parent) {
          mode = mode.parent;
        }
        return mode;
      }
      if (mode.endsWithParent) {
        return endOfMode(mode.parent, lexeme);
      }
    }

    function isIllegal(lexeme, mode) {
      return !ignore_illegals && testRe(mode.illegalRe, lexeme);
    }

    function keywordMatch(mode, match) {
      var match_str = language.case_insensitive ? match[0].toLowerCase() : match[0];
      return mode.keywords.hasOwnProperty(match_str) && mode.keywords[match_str];
    }

    function buildSpan(classname, insideSpan, leaveOpen, noPrefix) {
      var classPrefix = noPrefix ? '' : options.classPrefix,
          openSpan    = '<span class="' + classPrefix,
          closeSpan   = leaveOpen ? '' : spanEndTag

      openSpan += classname + '">';

      return openSpan + insideSpan + closeSpan;
    }

    function processKeywords() {
      var keyword_match, last_index, match, result;

      if (!top.keywords)
        return escape(mode_buffer);

      result = '';
      last_index = 0;
      top.lexemesRe.lastIndex = 0;
      match = top.lexemesRe.exec(mode_buffer);

      while (match) {
        result += escape(mode_buffer.substring(last_index, match.index));
        keyword_match = keywordMatch(top, match);
        if (keyword_match) {
          relevance += keyword_match[1];
          result += buildSpan(keyword_match[0], escape(match[0]));
        } else {
          result += escape(match[0]);
        }
        last_index = top.lexemesRe.lastIndex;
        match = top.lexemesRe.exec(mode_buffer);
      }
      return result + escape(mode_buffer.substr(last_index));
    }

    function processSubLanguage() {
      var explicit = typeof top.subLanguage === 'string';
      if (explicit && !languages[top.subLanguage]) {
        return escape(mode_buffer);
      }

      var result = explicit ?
                   highlight(top.subLanguage, mode_buffer, true, continuations[top.subLanguage]) :
                   highlightAuto(mode_buffer, top.subLanguage.length ? top.subLanguage : undefined);

      // Counting embedded language score towards the host language may be disabled
      // with zeroing the containing mode relevance. Usecase in point is Markdown that
      // allows XML everywhere and makes every XML snippet to have a much larger Markdown
      // score.
      if (top.relevance > 0) {
        relevance += result.relevance;
      }
      if (explicit) {
        continuations[top.subLanguage] = result.top;
      }
      return buildSpan(result.language, result.value, false, true);
    }

    function processBuffer() {
      result += (top.subLanguage != null ? processSubLanguage() : processKeywords());
      mode_buffer = '';
    }

    function startNewMode(mode) {
      result += mode.className? buildSpan(mode.className, '', true): '';
      top = Object.create(mode, {parent: {value: top}});
    }

    function processLexeme(buffer, lexeme) {

      mode_buffer += buffer;

      if (lexeme == null) {
        processBuffer();
        return 0;
      }

      var new_mode = subMode(lexeme, top);
      if (new_mode) {
        if (new_mode.skip) {
          mode_buffer += lexeme;
        } else {
          if (new_mode.excludeBegin) {
            mode_buffer += lexeme;
          }
          processBuffer();
          if (!new_mode.returnBegin && !new_mode.excludeBegin) {
            mode_buffer = lexeme;
          }
        }
        startNewMode(new_mode, lexeme);
        return new_mode.returnBegin ? 0 : lexeme.length;
      }

      var end_mode = endOfMode(top, lexeme);
      if (end_mode) {
        var origin = top;
        if (origin.skip) {
          mode_buffer += lexeme;
        } else {
          if (!(origin.returnEnd || origin.excludeEnd)) {
            mode_buffer += lexeme;
          }
          processBuffer();
          if (origin.excludeEnd) {
            mode_buffer = lexeme;
          }
        }
        do {
          if (top.className) {
            result += spanEndTag;
          }
          if (!top.skip) {
            relevance += top.relevance;
          }
          top = top.parent;
        } while (top !== end_mode.parent);
        if (end_mode.starts) {
          startNewMode(end_mode.starts, '');
        }
        return origin.returnEnd ? 0 : lexeme.length;
      }

      if (isIllegal(lexeme, top))
        throw new Error('Illegal lexeme "' + lexeme + '" for mode "' + (top.className || '<unnamed>') + '"');

      /*
      Parser should not reach this point as all types of lexemes should be caught
      earlier, but if it does due to some bug make sure it advances at least one
      character forward to prevent infinite looping.
      */
      mode_buffer += lexeme;
      return lexeme.length || 1;
    }

    var language = getLanguage(name);
    if (!language) {
      throw new Error('Unknown language: "' + name + '"');
    }

    compileLanguage(language);
    var top = continuation || language;
    var continuations = {}; // keep continuations for sub-languages
    var result = '', current;
    for(current = top; current !== language; current = current.parent) {
      if (current.className) {
        result = buildSpan(current.className, '', true) + result;
      }
    }
    var mode_buffer = '';
    var relevance = 0;
    try {
      var match, count, index = 0;
      while (true) {
        top.terminators.lastIndex = index;
        match = top.terminators.exec(value);
        if (!match)
          break;
        count = processLexeme(value.substring(index, match.index), match[0]);
        index = match.index + count;
      }
      processLexeme(value.substr(index));
      for(current = top; current.parent; current = current.parent) { // close dangling modes
        if (current.className) {
          result += spanEndTag;
        }
      }
      return {
        relevance: relevance,
        value: result,
        language: name,
        top: top
      };
    } catch (e) {
      if (e.message && e.message.indexOf('Illegal') !== -1) {
        return {
          relevance: 0,
          value: escape(value)
        };
      } else {
        throw e;
      }
    }
  }

  /*
  Highlighting with language detection. Accepts a string with the code to
  highlight. Returns an object with the following properties:

  - language (detected language)
  - relevance (int)
  - value (an HTML string with highlighting markup)
  - second_best (object with the same structure for second-best heuristically
    detected language, may be absent)

  */
  function highlightAuto(text, languageSubset) {
    languageSubset = languageSubset || options.languages || objectKeys(languages);
    var result = {
      relevance: 0,
      value: escape(text)
    };
    var second_best = result;
    languageSubset.filter(getLanguage).forEach(function(name) {
      var current = highlight(name, text, false);
      current.language = name;
      if (current.relevance > second_best.relevance) {
        second_best = current;
      }
      if (current.relevance > result.relevance) {
        second_best = result;
        result = current;
      }
    });
    if (second_best.language) {
      result.second_best = second_best;
    }
    return result;
  }

  /*
  Post-processing of the highlighted markup:

  - replace TABs with something more useful
  - replace real line-breaks with '<br>' for non-pre containers

  */
  function fixMarkup(value) {
    return !(options.tabReplace || options.useBR)
      ? value
      : value.replace(fixMarkupRe, function(match, p1) {
          if (options.useBR && match === '\n') {
            return '<br>';
          } else if (options.tabReplace) {
            return p1.replace(/\t/g, options.tabReplace);
          }
          return '';
      });
  }

  function buildClassName(prevClassName, currentLang, resultLang) {
    var language = currentLang ? aliases[currentLang] : resultLang,
        result   = [prevClassName.trim()];

    if (!prevClassName.match(/\bhljs\b/)) {
      result.push('hljs');
    }

    if (prevClassName.indexOf(language) === -1) {
      result.push(language);
    }

    return result.join(' ').trim();
  }

  /*
  Applies highlighting to a DOM node containing code. Accepts a DOM node and
  two optional parameters for fixMarkup.
  */
  function highlightBlock(block) {
    var node, originalStream, result, resultNode, text;
    var language = blockLanguage(block);

    if (isNotHighlighted(language))
        return;

    if (options.useBR) {
      node = document.createElementNS('http://www.w3.org/1999/xhtml', 'div');
      node.innerHTML = block.innerHTML.replace(/\n/g, '').replace(/<br[ \/]*>/g, '\n');
    } else {
      node = block;
    }
    text = node.textContent;
    result = language ? highlight(language, text, true) : highlightAuto(text);

    originalStream = nodeStream(node);
    if (originalStream.length) {
      resultNode = document.createElementNS('http://www.w3.org/1999/xhtml', 'div');
      resultNode.innerHTML = result.value;
      result.value = mergeStreams(originalStream, nodeStream(resultNode), text);
    }
    result.value = fixMarkup(result.value);

    block.innerHTML = result.value;
    block.className = buildClassName(block.className, language, result.language);
    block.result = {
      language: result.language,
      re: result.relevance
    };
    if (result.second_best) {
      block.second_best = {
        language: result.second_best.language,
        re: result.second_best.relevance
      };
    }
  }

  /*
  Updates highlight.js global options with values passed in the form of an object.
  */
  function configure(user_options) {
    options = inherit(options, user_options);
  }

  /*
  Applies highlighting to all <pre><code>..</code></pre> blocks on a page.
  */
  function initHighlighting() {
    if (initHighlighting.called)
      return;
    initHighlighting.called = true;

    var blocks = document.querySelectorAll('pre code');
    ArrayProto.forEach.call(blocks, highlightBlock);
  }

  /*
  Attaches highlighting to the page load event.
  */
  function initHighlightingOnLoad() {
    addEventListener('DOMContentLoaded', initHighlighting, false);
    addEventListener('load', initHighlighting, false);
  }

  function registerLanguage(name, language) {
    var lang = languages[name] = language(hljs);
    if (lang.aliases) {
      lang.aliases.forEach(function(alias) {aliases[alias] = name;});
    }
  }

  function listLanguages() {
    return objectKeys(languages);
  }

  function getLanguage(name) {
    name = (name || '').toLowerCase();
    return languages[name] || languages[aliases[name]];
  }

  /* Interface definition */

  hljs.highlight = highlight;
  hljs.highlightAuto = highlightAuto;
  hljs.fixMarkup = fixMarkup;
  hljs.highlightBlock = highlightBlock;
  hljs.configure = configure;
  hljs.initHighlighting = initHighlighting;
  hljs.initHighlightingOnLoad = initHighlightingOnLoad;
  hljs.registerLanguage = registerLanguage;
  hljs.listLanguages = listLanguages;
  hljs.getLanguage = getLanguage;
  hljs.inherit = inherit;

  // Common regexps
  hljs.IDENT_RE = '[a-zA-Z]\\w*';
  hljs.UNDERSCORE_IDENT_RE = '[a-zA-Z_]\\w*';
  hljs.NUMBER_RE = '\\b\\d+(\\.\\d+)?';
  hljs.C_NUMBER_RE = '(-?)(\\b0[xX][a-fA-F0-9]+|(\\b\\d+(\\.\\d*)?|\\.\\d+)([eE][-+]?\\d+)?)'; // 0x..., 0..., decimal, float
  hljs.BINARY_NUMBER_RE = '\\b(0b[01]+)'; // 0b...
  hljs.RE_STARTERS_RE = '!|!=|!==|%|%=|&|&&|&=|\\*|\\*=|\\+|\\+=|,|-|-=|/=|/|:|;|<<|<<=|<=|<|===|==|=|>>>=|>>=|>=|>>>|>>|>|\\?|\\[|\\{|\\(|\\^|\\^=|\\||\\|=|\\|\\||~';

  // Common modes
  hljs.BACKSLASH_ESCAPE = {
    begin: '\\\\[\\s\\S]', relevance: 0
  };
  hljs.APOS_STRING_MODE = {
    className: 'string',
    begin: '\'', end: '\'',
    illegal: '\\n',
    contains: [hljs.BACKSLASH_ESCAPE]
  };
  hljs.QUOTE_STRING_MODE = {
    className: 'string',
    begin: '"', end: '"',
    illegal: '\\n',
    contains: [hljs.BACKSLASH_ESCAPE]
  };
  hljs.PHRASAL_WORDS_MODE = {
    begin: /\b(a|an|the|are|I'm|isn't|don't|doesn't|won't|but|just|should|pretty|simply|enough|gonna|going|wtf|so|such|will|you|your|they|like|more)\b/
  };
  hljs.COMMENT = function (begin, end, inherits) {
    var mode = hljs.inherit(
      {
        className: 'comment',
        begin: begin, end: end,
        contains: []
      },
      inherits || {}
    );
    mode.contains.push(hljs.PHRASAL_WORDS_MODE);
    mode.contains.push({
      className: 'doctag',
      begin: '(?:TODO|FIXME|NOTE|BUG|XXX):',
      relevance: 0
    });
    return mode;
  };
  hljs.C_LINE_COMMENT_MODE = hljs.COMMENT('//', '$');
  hljs.C_BLOCK_COMMENT_MODE = hljs.COMMENT('/\\*', '\\*/');
  hljs.HASH_COMMENT_MODE = hljs.COMMENT('#', '$');
  hljs.NUMBER_MODE = {
    className: 'number',
    begin: hljs.NUMBER_RE,
    relevance: 0
  };
  hljs.C_NUMBER_MODE = {
    className: 'number',
    begin: hljs.C_NUMBER_RE,
    relevance: 0
  };
  hljs.BINARY_NUMBER_MODE = {
    className: 'number',
    begin: hljs.BINARY_NUMBER_RE,
    relevance: 0
  };
  hljs.CSS_NUMBER_MODE = {
    className: 'number',
    begin: hljs.NUMBER_RE + '(' +
      '%|em|ex|ch|rem'  +
      '|vw|vh|vmin|vmax' +
      '|cm|mm|in|pt|pc|px' +
      '|deg|grad|rad|turn' +
      '|s|ms' +
      '|Hz|kHz' +
      '|dpi|dpcm|dppx' +
      ')?',
    relevance: 0
  };
  hljs.REGEXP_MODE = {
    className: 'regexp',
    begin: /\//, end: /\/[gimuy]*/,
    illegal: /\n/,
    contains: [
      hljs.BACKSLASH_ESCAPE,
      {
        begin: /\[/, end: /\]/,
        relevance: 0,
        contains: [hljs.BACKSLASH_ESCAPE]
      }
    ]
  };
  hljs.TITLE_MODE = {
    className: 'title',
    begin: hljs.IDENT_RE,
    relevance: 0
  };
  hljs.UNDERSCORE_TITLE_MODE = {
    className: 'title',
    begin: hljs.UNDERSCORE_IDENT_RE,
    relevance: 0
  };
  hljs.METHOD_GUARD = {
    // excludes method names from keyword processing
    begin: '\\.\\s*' + hljs.UNDERSCORE_IDENT_RE,
    relevance: 0
  };

  return hljs;
}));

module.exports = function(hljs) {
  var VAR = {
    className: 'variable',
    variants: [
      {begin: /\$[\w\d#@][\w\d_]*/},
      {begin: /\$\{(.*?)}/}
    ]
  };
  var QUOTE_STRING = {
    className: 'string',
    begin: /"/, end: /"/,
    contains: [
      hljs.BACKSLASH_ESCAPE,
      VAR,
      {
        className: 'variable',
        begin: /\$\(/, end: /\)/,
        contains: [hljs.BACKSLASH_ESCAPE]
      }
    ]
  };
  var APOS_STRING = {
    className: 'string',
    begin: /'/, end: /'/
  };

  return {
    aliases: ['sh', 'zsh'],
    lexemes: /\b-?[a-z\._]+\b/,
    keywords: {
      keyword:
        'if then else elif fi for while in do done case esac function',
      literal:
        'true false',
      built_in:
        // Shell built-ins
        // http://www.gnu.org/software/bash/manual/html_node/Shell-Builtin-Commands.html
        'break cd continue eval exec exit export getopts hash pwd readonly return shift test times ' +
        'trap umask unset ' +
        // Bash built-ins
        'alias bind builtin caller command declare echo enable help let local logout mapfile printf ' +
        'read readarray source type typeset ulimit unalias ' +
        // Shell modifiers
        'set shopt ' +
        // Zsh built-ins
        'autoload bg bindkey bye cap chdir clone comparguments compcall compctl compdescribe compfiles ' +
        'compgroups compquote comptags comptry compvalues dirs disable disown echotc echoti emulate ' +
        'fc fg float functions getcap getln history integer jobs kill limit log noglob popd print ' +
        'pushd pushln rehash sched setcap setopt stat suspend ttyctl unfunction unhash unlimit ' +
        'unsetopt vared wait whence where which zcompile zformat zftp zle zmodload zparseopts zprof ' +
        'zpty zregexparse zsocket zstyle ztcp',
      _:
        '-ne -eq -lt -gt -f -d -e -s -l -a' // relevance booster
    },
    contains: [
      {
        className: 'meta',
        begin: /^#![^\n]+sh\s*$/,
        relevance: 10
      },
      {
        className: 'function',
        begin: /\w[\w\d_]*\s*\(\s*\)\s*\{/,
        returnBegin: true,
        contains: [hljs.inherit(hljs.TITLE_MODE, {begin: /\w[\w\d_]*/})],
        relevance: 0
      },
      hljs.HASH_COMMENT_MODE,
      QUOTE_STRING,
      APOS_STRING,
      VAR
    ]
  };
};
module.exports = function(hljs) {
  var IDENT_RE = '[A-Za-z$_][0-9A-Za-z$_]*';
  var KEYWORDS = {
    keyword:
      'in of if for while finally var new function do return void else break catch ' +
      'instanceof with throw case default try this switch continue typeof delete ' +
      'let yield const export super debugger as async await static ' +
      // ECMAScript 6 modules import
      'import from as'
    ,
    literal:
      'true false null undefined NaN Infinity',
    built_in:
      'eval isFinite isNaN parseFloat parseInt decodeURI decodeURIComponent ' +
      'encodeURI encodeURIComponent escape unescape Object Function Boolean Error ' +
      'EvalError InternalError RangeError ReferenceError StopIteration SyntaxError ' +
      'TypeError URIError Number Math Date String RegExp Array Float32Array ' +
      'Float64Array Int16Array Int32Array Int8Array Uint16Array Uint32Array ' +
      'Uint8Array Uint8ClampedArray ArrayBuffer DataView JSON Intl arguments require ' +
      'module console window document Symbol Set Map WeakSet WeakMap Proxy Reflect ' +
      'Promise'
  };
  var EXPRESSIONS;
  var NUMBER = {
    className: 'number',
    variants: [
      { begin: '\\b(0[bB][01]+)' },
      { begin: '\\b(0[oO][0-7]+)' },
      { begin: hljs.C_NUMBER_RE }
    ],
    relevance: 0
  };
  var SUBST = {
    className: 'subst',
    begin: '\\$\\{', end: '\\}',
    keywords: KEYWORDS,
    contains: []  // defined later
  };
  var TEMPLATE_STRING = {
    className: 'string',
    begin: '`', end: '`',
    contains: [
      hljs.BACKSLASH_ESCAPE,
      SUBST
    ]
  };
  SUBST.contains = [
    hljs.APOS_STRING_MODE,
    hljs.QUOTE_STRING_MODE,
    TEMPLATE_STRING,
    NUMBER,
    hljs.REGEXP_MODE
  ]
  var PARAMS_CONTAINS = SUBST.contains.concat([
    hljs.C_BLOCK_COMMENT_MODE,
    hljs.C_LINE_COMMENT_MODE
  ]);

  return {
    aliases: ['js', 'jsx'],
    keywords: KEYWORDS,
    contains: [
      {
        className: 'meta',
        relevance: 10,
        begin: /^\s*['"]use (strict|asm)['"]/
      },
      {
        className: 'meta',
        begin: /^#!/, end: /$/
      },
      hljs.APOS_STRING_MODE,
      hljs.QUOTE_STRING_MODE,
      TEMPLATE_STRING,
      hljs.C_LINE_COMMENT_MODE,
      hljs.C_BLOCK_COMMENT_MODE,
      NUMBER,
      { // object attr container
        begin: /[{,]\s*/, relevance: 0,
        contains: [
          {
            begin: IDENT_RE + '\\s*:', returnBegin: true,
            relevance: 0,
            contains: [{className: 'attr', begin: IDENT_RE, relevance: 0}]
          }
        ]
      },
      { // "value" container
        begin: '(' + hljs.RE_STARTERS_RE + '|\\b(case|return|throw)\\b)\\s*',
        keywords: 'return throw case',
        contains: [
          hljs.C_LINE_COMMENT_MODE,
          hljs.C_BLOCK_COMMENT_MODE,
          hljs.REGEXP_MODE,
          {
            className: 'function',
            begin: '(\\(.*?\\)|' + IDENT_RE + ')\\s*=>', returnBegin: true,
            end: '\\s*=>',
            contains: [
              {
                className: 'params',
                variants: [
                  {
                    begin: IDENT_RE
                  },
                  {
                    begin: /\(\s*\)/,
                  },
                  {
                    begin: /\(/, end: /\)/,
                    excludeBegin: true, excludeEnd: true,
                    keywords: KEYWORDS,
                    contains: PARAMS_CONTAINS
                  }
                ]
              }
            ]
          },
          { // E4X / JSX
            begin: /</, end: /(\/\w+|\w+\/)>/,
            subLanguage: 'xml',
            contains: [
              {begin: /<\w+\s*\/>/, skip: true},
              {
                begin: /<\w+/, end: /(\/\w+|\w+\/)>/, skip: true,
                contains: [
                  {begin: /<\w+\s*\/>/, skip: true},
                  'self'
                ]
              }
            ]
          }
        ],
        relevance: 0
      },
      {
        className: 'function',
        beginKeywords: 'function', end: /\{/, excludeEnd: true,
        contains: [
          hljs.inherit(hljs.TITLE_MODE, {begin: IDENT_RE}),
          {
            className: 'params',
            begin: /\(/, end: /\)/,
            excludeBegin: true,
            excludeEnd: true,
            contains: PARAMS_CONTAINS
          }
        ],
        illegal: /\[|%/
      },
      {
        begin: /\$[(.]/ // relevance booster for a pattern common to JS libs: `$(something)` and `$.something`
      },
      hljs.METHOD_GUARD,
      { // ES6 class
        className: 'class',
        beginKeywords: 'class', end: /[{;=]/, excludeEnd: true,
        illegal: /[:"\[\]]/,
        contains: [
          {beginKeywords: 'extends'},
          hljs.UNDERSCORE_TITLE_MODE
        ]
      },
      {
        beginKeywords: 'constructor', end: /\{/, excludeEnd: true
      }
    ],
    illegal: /#(?!!)/
  };
};
/**
 *
 */
(function(root, Promise) {
"use strict";

var PARAM_REGEX = /\:([\w_\$]+)/g;

/** @namespace */
var cxl = root.cxl = {

	Promise: Promise,

	/**
	 *  Starts framework and DOM
	 */
	start: function(config)
	{
		config = config || {};

		cxl.dom.ready(function() {
			cxl.dom.start();
			// TODO Better start for plugins
			if (cxl.router)
				cxl.router.start();
		});
	},

	resolve: function(a)
	{
		var promises, keys;

		// TODO better isPromise function
		if (a && !a.then && a.constructor===Object)
		{
			promises = Object.values(a);
			keys = Object.keys(a);

			return Promise.all(promises).then(function(a) {
				return cxl.zipObject(keys, a);
			});
		}

		return Array.isArray(a) ? Promise.all(a) : Promise.resolve(a);
	},

	replaceParameters: function(path, params)
	{
		if (params===null || params===undefined)
			return path;

		if (typeof(params)!=='object')
			params = { $: params };

		return path.replace(PARAM_REGEX, function(match, key) {
			return params[key];
		});
	},

	ENTITIES_REGEX: /[&<]/g,
	ENTITIES_MAP: {
		'&': '&amp;',
		'<': '&lt;'
	},

	/**
	 * Escape html entities
	 */
	escape: function(str)
	{
		return str.replace(cxl.ENTITIES_REGEX, function(e) {
			return cxl.ENTITIES_MAP[e];
		});
	},

	extendClass: function(Parent, p, s)
	{
	var
		Result = p && p.hasOwnProperty('constructor') ? p.constructor :
			function() { return Parent.apply(this, arguments); }
	;
		return cxl.inherits(Result, Parent, p, s);
	}

};

})(this, this.Promise);



Object.assign(cxl, {

	/// Simple debounce function.
	debounce: function(fn, delay)
	{
		var to;

		function Result() {
			var args = arguments, thisVal = this;

			if (to)
				clearTimeout(to);
			to = setTimeout(function() {
				Result.fn.apply(thisVal, args);
			}, delay);
		}
		Result.fn = fn;
		Result.cancel = function() {
			clearTimeout(to);
		};

		return Result;
	},

	promiseProperty: function(obj, prop, options)
	{
		options = Object.assign({ delay: 50, tries: 10 }, options);

		return new cxl.Promise(function(resolve, reject) {
		var
			tries = options.tries,
			check = function() {
				if (obj[prop]!==undefined)
					resolve(obj[prop]);
				else if (tries--)
					setTimeout(check, options.delay);
				else
					reject();
			}
		;
			check();
		});
	},

	extend: function(A)
	{
		var a = 1, l=arguments.length, B, i;

		while (a<l)
		{
			B = arguments[a++];

			for (i in B)
				if (B.hasOwnProperty(i))
					Object.defineProperty(A, i, Object.getOwnPropertyDescriptor(B, i));
		}

		return A;
	},

	result: function(obj, path)
	{
		var val = obj[path];
		return typeof(val)==='function' ? val.call(obj) : val;
	},

	each: function(coll, fn, scope)
	{
		if (Array.isArray(coll))
			return coll.forEach(fn, scope);

		for (var i in coll)
			fn.call(scope, coll[i], i);
	},

	map: function(coll, fn, scope)
	{
		if (Array.isArray(coll))
			return coll.map(fn, scope);

		var result = [];

		for (var i in coll)
			result.push(fn.call(scope, coll[i], i));

		return result;
	},

	indexOf: function(coll, val)
	{
		if (Array.isArray(coll))
			return coll.indexOf(val);

		for (var index in coll)
			if (coll[index]===val)
				return index;

		return -1;
	},

	/*type: function(A)
	{
		var to = typeof(A);

		if (to==='string') return String;
		if ()
	},*/

	/**
	 * Pushes unique values of B into A
	 */
	pushUnique: function(A, B)
	{
		B.forEach(function(i) {
			if (A.indexOf(i)===-1)
				A.push(i);
		});

		return A;
	},

	pull: function(coll, val)
	{
		var i = cxl.indexOf(coll, val);
		if (i!==-1)
		{
			if (Array.isArray(coll))
				coll.splice(i, 1);
			else
				delete coll[i];
		}
	},

	zipObject: function(keys, values)
	{
		return keys.reduce(function(result, val, i) {
			result[val] = values[i];
			return result;
		}, {});
	},

	sortBy: function(array, field)
	{
		return array.sort(function(a, b) {
			return b[field] > a[field] ? -1 : 1;
		});
	},

	inherits: function(Child, Parent, p, s)
	{
		Child.prototype = Object.create(Parent.prototype);

		cxl.extend(Child.prototype, p);

		if (s)
			cxl.extend(Child, s);

		Child.prototype.constructor = Child;

		return Child;
	},


	invokeMap: function (array, fn, val)
	{
		if (Array.isArray(array))
			array.forEach(function(a) { if (a[fn]) a[fn](val); });
		else
			for (var i in array)
				if (array[i][fn])
					array[i][fn](val);
	}

});

(function(cxl) {
"use strict";

var
	rx = cxl.rx = {}
;

rx.Subscription = function(unsubscribe)
{
	var unsubscribed = false;
	this.unsubscribe = function() {
		if (!unsubscribed)
		{
			unsubscribed = true;
			unsubscribe();
		}
	};
};

rx.Subscriber = function(observer, error, complete, unsubscribe)
{
	if (observer && typeof(observer)!=='function')
	{
		error = observer.error;
		complete = observer.complete;
		observer = observer.next;
	}

	this.isUnsubscribed = false;
	this.__next = observer;
	this.__error = error;
	this.__complete = complete;
	this.__unsubscribe = unsubscribe;
};

rx.Subscriber.prototype = {

	next: function(val)
	{
		if (!this.isUnsubscribed && this.__next)
			this.__next.call(this, val);
	},

	error: function(e)
	{
		if (!this.isUnsubscribed && this.__error)
			this.__error.call(this, e);
		this.unsubscribe();
	},

	complete: function()
	{
		if (!this.isUnsubscribed && this.__complete)
			this.__complete.call(this);
		this.unsubscribe();
	},

	unsubscribe: function() {
		this.isUnsubscribed = true;
		if (this.__unsubscribe) this.__unsubscribe();
	}

};

rx.Observable = function(subscribe)
{
	this.__subscribe = subscribe;
};

rx.Observable.create = function(subscriber)
{
	return new rx.Observable(subscriber);
};

rx.Observable.prototype = {

	subscribe: function(observer, error, complete)
	{
	var
		subscriber = new rx.Subscriber(observer, error, complete)
	;
		// TODO safe?
		subscriber.__unsubscribe = this.__subscribe(subscriber);

		return subscriber;
	}

};

rx.Subject = function(onSubscribe)
{
	this.onSubscribe = onSubscribe;
};

cxl.inherits(rx.Subject, rx.Observable, {

	__subscribe: function(subscriber)
	{
		var subscribers = this.__subscribers || (this.__subscribers=[]);

		subscribers.push(subscriber);

		if (this.onSubscribe)
			this.onSubscribe(subscriber);

		return function() {
			var i = subscribers.indexOf(subscriber);

			if (i===-1)
				throw "Invalid subscriber";

			subscribers.splice(i, 1);
		};
	},

	next: function(a) {
		cxl.invokeMap(this.__subscribers, 'next', a);
	},

	error: function(e) {
		cxl.invokeMap(this.__subscribers, 'error', e);
	},

	complete: function() {
		cxl.invokeMap(this.__subscribers, 'complete');
	}

});

cxl.inherits(rx.BehaviorSubject = function(val) {
	rx.Subject.call(this);
	this.value = val;
}, rx.Subject, {

	subscribe: function()
	{
		var result = rx.Subject.prototype.subscribe.apply(this, arguments);
		result.next(this.value);
		return result;
	},

	next: function(val)
	{
		this.value = val;
		rx.Subject.prototype.next.call(this, val);
	}

});

cxl.rx.Collection = function(native) {
	this.value = native || [];
};

cxl.inherits(cxl.rx.Collection, cxl.rx.Subject, {

	onSubscribe: function(subscriber)
	{
		this.each(function(val, key) {
			subscriber.next({ event: 'child_added', index: key, item: val });
		});
	},

	get length() {
		return this.value.length;
	},

	indexOf: function(val)
	{
		var i = 0, l=this.length;

		for (;i<l; i++)
			if (val===this.child(i))
				return i;

		return -1;
	},

	remove: function(index)
	{
		var val = this.child(index);
		this.value.splice(index, 1);
		this.event('child_removed', index, val);
	},

	event: function(event, index, item, key)
	{
		if (this.__subscribers)
			this.next({ event: event, index: index, item: item, key: key });
	},

	child: function(key)
	{
		return this.value[key];
	},

	insert: function(val, index)
	{
		if (index=== undefined || index===null)
		{
			index = this.value.length;
			this.value.push(val);
		}
		else
			this.value.splice(index, 0, val);

		this.event('child_added', index, this.child(index));
	},

	empty: function()
	{
		// TODO ?
		while (this.value[0])
			this.remove(0);
	},

	each: function(fn, scope)
	{
		var i = 0, l=this.length;

		for (;i<l; i++)
			fn.call(scope, this.child(i), i);
	},

	map: function(fn, scope)
	{
		var result = [];

		this.each(function(val, key) {
			result.push(fn ? fn.call(scope, val, key) : val);
		});

		return result;
	}

});

cxl.rx.ObjectCollection = function(value) {
	value = value || {};
	this.$keySeed = 0;
	this.keys = Object.keys(value);
	this.object = value;

	cxl.rx.Collection.call(this, Object.values(value));
};

cxl.inherits(cxl.rx.ObjectCollection, cxl.rx.Collection, {

	onSubscribe: function(subscriber)
	{
		this.each(function(val, index) {
			subscriber.next({
				event: 'child_added', index: index,
				item: val, key: this.keys[index]
			});
		}, this);
	},

	remove: function(key)
	{
	var
		// TODO optimize
		index = this.keys.indexOf(key),
		item = this.object[key]
	;
		if (index===-1)
			throw new Error("Invalid item key");

		this.keys.splice(index, 1);
		this.value.splice(index, 1);

		delete this.object[key];

		this.event('child_removed', index, item, key);
	},

	empty: function()
	{
		while (this.keys.length)
			this.remove(this.keys[0]);
	},

	// TODO ???
	randomKey: function()
	{
		var key;

		do {
			key = this.$keySeed++;
		} while (!(key in this.value));

		return key;
	},

	insert: function(val, key, nextKey)
	{
		var index;

		if (key===undefined || key===null)
			key = this.randomKey();

		if (nextKey===undefined || nextKey===null)
		{
			index = this.keys.indexOf(nextKey);

			if (index===-1)
				throw new Error("Invalid nextKey");
		} else
			index = this.keys.length;

		this.object[key] = val;
		this.keys[index] = key;
		this.values[index] = val;

		this.event('child_added', index, val, key);
	}

});

})(this.cxl || global.cxl);
/*
 * cxl-dom
 *
 * Lightweight DOM implementation
 *
 * - No classes
 * - No getAttribute
 */
(function(cxl) {

/**
 * Node factory.
 */
function NodeFactory()
{
	this.components = {};
	this.decorators = {};
}

NodeFactory.prototype = {

	$transclude: function(component, parent)
	{
		if (component.$native.firstElementChild)
			this.traverse(component.$native.firstElementChild, parent);
	},

	$attributes: function(component, value)
	{
		var el = component.$native;

		value.forEach(function(a) {
			if (el.hasAttribute(a))
				component.set(a, el.getAttribute(a) || true);
		});
	},

	$bindings: function(component, value)
	{
		value.forEach(function(b) {
			cxl.parseBinding(component, b, component);
		});
	},

	$initializeComponent: function(component, controller)
	{
	var
		meta = component.$meta,
		template = meta.$template
	;
		for (var i in this.decorators)
			if (i in meta)
				this.decorators[i](component, meta[i]);

		if (meta.bindings)
			this.$bindings(component, meta.bindings);

		if (meta.beforeDigest)
			meta.beforeDigest.call(component, controller);

		if (template)
		{
			if (meta.shadow===false)
				template.setContent(component);
			else
				template.setShadowContent(component);
		}

		if (meta.ready)
			cxl.renderer.render(meta.ready.bind(component, controller));
	},

	createComponent: function(node, meta, state)
	{
	var
		controller = meta.controller ? new meta.controller(state) : {},
		component = new Component(node)
	;
		if (!meta.$template)
		{
			if (meta.templateId)
				meta.$template = Template.fromId(meta.templateId);
			else if (meta.template)
				meta.$template = meta.template instanceof Template ? meta.template : new Template(meta.template);
		}

		if (!meta.$styles && meta.styles)
			meta.$styles = new cxl.dom.StyleSheet(meta);

		if (state)
		{
			Object.assign(controller, state);
			controller.$parameters = state;
		}

		component.$state = controller;
		controller.$component = component;
		component.$meta = meta;

		cxl.renderer.render(this.$initializeComponent.bind(this, component, controller));
		// Add digest to pipeline before children.
		cxl.renderer.digest(component);

		if (meta.attributes)
			this.$attributes(component, meta.attributes);

		if (meta.initialize)
			meta.initialize.call(component, controller);

		if (meta.content)
			this.$transclude(component, component);

		return component;
	},

	extendComponent: function(def, parent)
	{
		var extend = this.components[parent].$meta;
		def = Object.assign({}, extend, def);
		def.controller.prototype = Object.assign({}, extend.controller.prototype, def.controller.prototype);

		if (def.bindings && def.bindings !== extend.bindings)
			def.bindings.push.apply(def.bindings, extend.bindings);

		return def;
	},

	componentConstructor: function(def)
	{
		function Result(attributes)
		{
		var
			el = document.createElement(def.name || 'DIV'),
			comp = factory.createComponent(el, def, attributes)
		;
			cxl.renderer.commit();
			return comp;
		}

		Result.$meta = def;

		return Result;
	},

	normalize: function(def)
	{
		var result;

		if (def.extend)
			def = this.extendComponent(def, def.extend.toUpperCase());

		result = this.componentConstructor(def);

		if (def.name)
			this.components[def.name.toUpperCase()] = result;

		return result;
	},

	fromNative: function(node, attributes)
	{
		if (node.$element)
			return node.$element;
	var
		Meta = this.components[node.tagName],
		result
	;
		if (Meta)
			result = this.createComponent(node, Meta.$meta, attributes);
		else if (node.tagName || node instanceof window.DocumentFragment)
			result = new Element(node);
		else if (node instanceof window.Text)
			result = new TextNode(node);
		else
			result = new Node(node);

		return result;
	},

	fromName: function(tagName, attributes)
	{
		var el = document.createElement(tagName);

		return this.fromNative(el, attributes);
	},

	registerComponent: function(tagName, fn)
	{
		this.components[tagName.toUpperCase()] = fn;
	},

	traverse:function(node, owner)
	{
	var
		meta = this.components[node.tagName],
		binding = node.getAttribute && node.getAttribute('&'),
		// Prevent DOM modification
		child = !meta && node.firstElementChild,
		next = node.nextElementSibling,
		element
	;
		if (meta || binding)
		{
			element = this.fromNative(node);

			if (meta)
			{
				owner.$children.push(element);

				if (!meta.$meta.content && meta.$meta.transclude!==false)
					this.$transclude(element, owner);
			}

			if (binding)
				cxl.parseBinding(element, binding, owner);
		}

		if (child)
			this.traverse(node.firstElementChild, owner);

		if (next)
			this.traverse(next, owner);
	}

};

var
	goLink = window.document.createElement('A'),
	meta = document.createElement('META'),
	factory = new NodeFactory()
;

	// Set view port
	meta.name = 'viewport';
	meta.content = 'width=device-width, initial-scale=1';
	document.head.appendChild(meta);

cxl.dom = function(el, attributes)
{
	// TODO should we always provide owner? cxl-root by default?
	var result = factory.fromName(el, attributes);
	cxl.renderer.commit();
	return result;
};

function Node(native)
{
	this.$native = native;
	this.$native.$element = this;
}

Node.prototype = {

	$native: null,

	get parent()
	{
		return this.$native.parentNode && factory.fromNative(this.$native.parentNode);
	},

	remove: function()
	{
		if (this.parent)
			this.parent.removeChild(this);
	},

	matches: function(selector)
	{
		return selector.split(',').find(function(tag) {
			return this.tagName===tag.trim().toUpperCase();
		}, this);
	},

	destroy: function()
	{
		// TODO
	}

};

function NodeCollection(nodes)
{
	this.$nodes = nodes;
}

NodeCollection.prototype = {

	child: function(n)
	{
		var el = this.$nodes[n];

		return el ? el.$element || factory.fromNative(el) : null;
	},

	indexOf: function(el)
	{
		return Array.prototype.indexOf.call(this.$nodes, el.$native);
	},

	get length()
	{
		return this.$nodes.length;
	},

	each: function(cb, scope)
	{
		var i=0, l=this.$nodes.length;

		for (; i<l; i++)
			cb.call(scope, this.child(i));
	},

	query: function(selector, cb, scope)
	{
		var result;

		if (!cb)
		{
			result = [];
			cb = function(val) { result.push(val); };
		}

		this.each(function(val, key) {
			if (val.matches(selector))
				cb.call(scope, val, key);
		}	);

		return result;
	},

	map: function(fn, scope)
	{
		var result = [];

		this.each(function(val, key) {
			result.push(fn ? fn.call(scope, val, key) : val);
		});

		return result;
	},

	insertTo: function(element, next)
	{
		this.map().forEach(function(node) {
			element.insert(node, next);
		}, this);
	}

};

/**
 * Bounding Rect of Element
 */
function ElementRect(el)
{
	this.$element = el.$native;
}

ElementRect.prototype = {
	get width() { return this.$element.clientWidth; },
	get height() { return this.$element.clientHeight; },
	get bottom() { return this.$element.getBoundingClientRect().bottom; },
	get top() { return this.$element.getBoundingClientRect().top; },
	get left() { return this.$element.getBoundingClientRect().left; },
	get right() { return this.$element.getBoundingClientRect().right; },

	get clientLeft() { return this.$element.clientLeft; },
	get clientTop() { return this.$element.clientTop; },
	get offsetLeft() { return this.$element.offsetLeft; },
	get offsetTop() { return this.$element.offsetTop; },

	get scrollTop() { return this.$element.scrollTop; },
	get scrollLeft() { return this.$element.scrollLeft; },
	get scrollHeight() { return this.$element.scrollHeight; },
	get scrollWidth() { return this.$element.scrollWidth; },
	set scrollTop(val) { this.$element.scrollTop = val; },
	set scrollLeft(val) { this.$element.scrollLeft = val; }
};

/**
 * DOM Element
 */
function Element(el)
{
	Node.call(this, el);

	this.tagName = el.tagName;
	this.$nodes = el.childNodes;
	this.$parentBindings = [];
}

cxl.inherits(Element, Node, {

	// inlineStyle object
	$style: null,
	$rect: null,
	tagName: null,

	get rect()
	{
		return this.$rect || (this.$rect = new ElementRect(this));
	},

	setStyle: function(name, toggle)
	{
		this.$native.classList[toggle || toggle===undefined ? 'add' : 'remove'](name);
	},

	get inlineStyle()
	{
		return this.$style || (this.$style=new cxl.dom.Style(null, this.$native.style));
	},

	trigger: function(event, data)
	{
		var ev = new CustomEvent(event, { detail: data, bubbles: true });

		this.$native.dispatchEvent(ev);
	},

	focus: function()
	{
		this.$native.focus();
	},

	on: function(event, next)
	{
		var subscriber = new cxl.rx.Subscriber(function(native) {
			native = native.$event || new cxl.dom.Event(native);
			next(native);
		});

		subscriber.__unsubscribe = this.$native.removeEventListener.bind(this.$native, event, next);

		this.$native.addEventListener(event, subscriber.next.bind(subscriber));

		return subscriber;
	},

	$event: function(event)
	{
		if (this.$observer)
			this.$observer.next(event);
	},

	$onSubscribe: function(subscriber)
	{
		this.childNodes.map().forEach(function(item, key) {
			subscriber.next({ event: 'child_added', item: item, key: key });
		});
	},

	get observer()
	{
		return this.$observer ||
			(this.$observer = new cxl.rx.Subject(this.$onSubscribe.bind(this)));
	},

	get childNodes()
	{
		return this.$childNodes ||
			(this.$childNodes=new NodeCollection(this.$nodes));
	},

	child: function(x)
	{
		return this.childNodes.child(x);
	},

	$doInsert: function(el, next)
	{
		if (next)
			this.$native.insertBefore(el.$native, next.$native);
		else
			this.$native.appendChild(el.$native);

		// TODO?
		return Array.prototype.indexOf.call(this.$nodes, el.$native);
	},

	insert: function(el, next)
	{
		if (!(el instanceof Node))
			el = new TextNode(document.createTextNode(el));

		if (el.parent)
			el.remove();

		var key = this.$doInsert(el, next);

		if (this.$observer)
			this.$event({ event: 'child_added', item: el, key: key });
	},

	$doRemoveChild: function(child)
	{
		this.$native.removeChild(child.$native);
	},

	removeChild: function(child)
	{
		var key;

		if (this.$observer)
			key = Array.prototype.indexOf.call(this.$nodes, child.$native);

		this.$doRemoveChild(child, key);

		if (this.$observer)
			this.$event({ event: 'child_removed', item: child, key: key });
	},

	setContent: function(content)
	{
		this.empty();

		if (content!==undefined && content!==null)
			this.insert(content);
	},

	empty: function()
	{
		while (this.$nodes[0])
			this.removeChild(this.child(0));
	},

	destroy: function()
	{
		if (this.$parentBindings)
			this.$parentBindings.forEach(function(b) { b.complete(); });
	},

	set: function(attr, val)
	{
		this.$native[attr] = val;
	},

	get: function(attr)
	{
		return this.$native[attr];
	}

});

//
// TextNode
//
function TextNode(native)
{
	Node.call(this, native);
}

cxl.inherits(TextNode, Node, {

	tagName: '$text',

	toString: function()
	{
		return this.$native.data;
	}

});

//
// cxl.Template
//
function Template(content)
{
	// TODO optimize
	if (content instanceof NodeCollection)
	{
		this.$content = document.createDocumentFragment();
		Array.prototype.slice.call(content.$nodes, 0).forEach(function(el) {
			this.$content.appendChild(el);
		}, this);
	} else if (content instanceof Node)
	{
		this.$content = document.createDocumentFragment();
		this.$content.appendChild(content.$native);
	}
	else
	{
		this.$content = document.createRange().createContextualFragment(content);
	}
}

Template.prototype = {

	render: function(attributes)
	{
	var
		fragment = this.$content.cloneNode(true)
	;
		return factory.createComponent(fragment, {
			content: true
		}, attributes);
	},

	compile: function(component)
	{
		var frag = this.$content.cloneNode(true);

		cxl.renderer.digest(component);
		factory.traverse(frag, component);

		return new NodeCollection(Array.prototype.slice.call(frag.childNodes, 0));
	},

	setContent: function(component)
	{
	var
		clone = this.$content.cloneNode(true),
		root = component.$native
	;
		factory.traverse(clone, component);
		root.appendChild(clone);
	},

	setShadowContent: function(component)
	{
	var
		clone = this.$content.cloneNode(true),
		root = component.$attachShadow().$native
	;
		root.appendChild(clone);
		factory.traverse(root, component);
	}

};

Template.fromId = function(id)
{
	return new Template(document.getElementById(id).innerHTML);
};

function Event(native) {
	this.target = native.target.$element;
	this.currentTarget = native.currentTarget.$element;
	this.stopPropagation = native.stopPropagation.bind(native);
	this.preventDefault = native.preventDefault.bind(native);
	// TODO add more properties and normalize
	this.key = native.key;
	this.type = native.type;
	this.x = native.x;
	this.y = native.y;
	native.$event = this;
}

/**
 * Normalizes path.
 */
function getPath(path)
{
	var hash;
	// TODO
	if (path[0]!=='/')
	{
		hash = window.location.hash;
		path = hash.substr(1) + (hash[hash.length-1]==='/' ? '' : '/') + path;
	}

	goLink.setAttribute('href', path);
	path = goLink.href.slice(window.location.origin.length);

	return path;
}

cxl.location = new cxl.rx.Subject();

cxl.location.go = function(path) {
	if (path[0]==='#')
		window.location.hash = getPath(path.slice(1));
	else
		window.location = path;
};

cxl.location.toString = function() {
	return window.location.toString();
};

cxl.location.path = getPath;

window.addEventListener('hashchange', function() {
	var hash = cxl.location.hash = window.location.hash.slice(1);
	cxl.location.next(hash);
});

cxl.location.hash = window.location.hash.slice(1);

function ShadowRoot(el)
{
	if (!el)
		throw "A component is needed to attach a shadow root.";

	this.$createNative(el);
	this.$host = el;
	this.$nodes = this.$native.childNodes;
	this.$native.$element = this;
}

cxl.inherits(ShadowRoot, Element, {

	$createNative: function(el)
	{
		this.$native = el.$native.attachShadow({mode: 'open'});
	},

	get host()
	{
		return this.$host;
	}

});
//
// cxl.dom.Component
//
function Component(el)
{
	Element.call(this, el);

	this.$bindings = [];
	this.$children = [];
	this.$initializeNodes();
}

cxl.inherits(Component, Element, {

	$initializeNodes: function() { },

	$slots: null,
	/// Shadow Root
	$shadowRoot: null,

	$bindings: null,
	/// Children components
	$children: null,
	/// Use by renderer to determine wheter to draw or not
	$dirty: false,

	$styles: null,

	$attachShadow: function()
	{
		return (this.$shadowRoot = new ShadowRoot(this));
	},

	set: function(attr, val)
	{
		this.$state[attr] = val;
		cxl.renderer.digest(this);
	},

	get: function(attr)
	{
		return this.$state[attr];
	},

	// TODO see if we need this
	get slots()
	{
		return this.$slots || (this.$slots = []);
	},

	$doInsertSlot: function(el)
	{
		var i=0, slot;

		for (i;i<this.slots.length;i++)
		{
			slot = this.slots[i].parameters;

			if (slot && el.matches(slot))
			{
				el.$native.slot = slot;
				break;
			}
		}
	},

	$doInsert: function(el, next)
	{
		// Handle slots
		if (this.$slots)
			this.$doInsertSlot(el);

		Element.prototype.$doInsert.call(this, el, next);
	},

	destroy: function() {

		Element.prototype.destroy.call(this);

		if (this.$bindings)
			this.$bindings.forEach(function(b) { b.complete(); });

		// TODO see if we can remove children
		if (this.$children)
			this.$children.forEach(function(c) { c.destroy(); });
	}

});

cxl.component = function(def, controller)
{
	// Normalize
	if (typeof(controller)==='function')
		def.controller = controller;
	else
	{
		def.controller = controller && controller.hasOwnProperty('constructor') ? controller.constructor : function() {};
		def.controller.prototype = controller;
	}

	return factory.normalize(def);
};

cxl.extend(cxl.dom, {

	$factory: factory,

	Component: Component,
	Element: Element,
	Event: Event,
	Node: Node,
	ShadowRoot: ShadowRoot,
	Template: Template,
	TextNode: TextNode,

	isReady: false,
	get title() { return window.document.title; },
	set title(val) { window.document.title = val; },

	compile: function(el)
	{
		return factory.traverse(el, cxl.dom.root);
	},

	template: function(el)
	{
		var template = new cxl.dom.Template(el);

		return template.render.bind(template);
	},

	startRoot: function()
	{
	var
		el = document.body.querySelector('cxl-root') || document.createElement('cxl-root'),
		content = el.childNodes,
		template = content.length && new Template(new NodeCollection(el.childNodes))
	;
		cxl.dom.root = factory.createComponent(el, {
			template: template,
			attributes: [ 'ready' ],
			transclude: false,
			bindings: [ '=ready:style(ready)' ],
			ready: function() {
				this.set('ready', true);
			}
		});
	},

	start: function()
	{
		cxl.dom.startRoot();
	},

	// TODO
	requestAnimationFrame: window.requestAnimationFrame.bind(window),
	cancelAnimationFrame: window.cancelAnimationFrame.bind(window),

	ready: function(fn)
	{
		if (this.isReady)
			fn();
		else
			document.addEventListener('DOMContentLoaded', fn);
	},

	marker: function(content)
	{
		var x = document.createComment(content);

		return new Node(x);
	},

	registerDecorator: function(name, fn)
	{
		factory.decorators[name] = fn;
	}

});

cxl.component({
	name: 'cxl-fragment',
	transclude: false,
	initialize: function() {
	var
		marker = cxl.dom.marker('cxl-fragment'),
		c = this,
		nodes = []
	;
		c.parent.insert(marker, c);
		c.remove();
		c.template = new cxl.dom.Template(this.childNodes);

		c.empty = function()
		{
			while (nodes[0])
				c.$doRemoveChild(nodes[0]);
		};

		c.$doRemoveChild = function(item) {
			if (item.parent!==c)
				marker.parent.removeChild(item);

			var i = nodes.indexOf(item);

			if (i!==-1)
				nodes.splice(i, 1);
		};

		c.$doInsert = function(item, next)
		{
			nodes.push(item);
			marker.parent.insert(item, next || marker);
		};
	}
});


document.addEventListener('DOMContentLoaded', function() {
	cxl.dom.isReady = true;
});

})(this.cxl);

(function(cxl) {

var
	CID = 0,
	// Global StyleSheet
	STYLES = (function() {
		var a = document.createElement('STYLE');
		// TODO Figure out a better way?
		a.innerHTML = 'cxl-root { font-size: 16px; display: none; opacity: 0;' +
			'position: absolute; top: 0; left: 0; right: 0; ' +
			'bottom: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI",' +
			'Roboto, "Helvetica Neue", Arial, sans-serif; }' +
			'cxl-root.ready { display: block; opacity: 1; } body span { display: inline; }';
		document.head.appendChild(a);
		return a;
	})(),

	BREAKPOINTS = cxl.dom.breakpoints = { small: 480, medium: 960, large: 1280, xlarge: 1600 },

	CSS = {
		zIndex: 'z-index',
		marginTop: 'margin-top',
		marginLeft: 'margin-left',
		marginRight: 'margin-right',
		marginBottom: 'margin-bottom',
		flexBasis: 'flex-basis',
		paddingTop: 'padding-top',
		paddingLeft: 'padding-left',
		paddingRight: 'padding-right',
		paddingBottom: 'padding-bottom',
		fontSize: 'font-size',
		lineHeight: 'line-height',
		borderBottom: 'border-bottom',
		borderTop: 'border-top',
		borderLeft: 'border-left',
		borderRight: 'border-right',
		borderRadius: 'border-radius',
		borderColor: 'border-color',
		borderWidth: 'border-width',
		boxShadow: 'box-shadow',
		fontFamily: 'font-family',
		fontWeight: 'font-weight',
		backgroundColor: 'background-color',
		overflowX: 'overflow-x',
		overflowY: 'overflow-y',
		textDecoration: 'text-decoration',
		borderStyle: 'border-style',
		textTransform: 'text-transform',
		textAlign: 'text-align',
		flexGrow: 'flex-grow',
		flexDirection: 'flex-direction',
		justifyContent: 'justify-content',
		whiteSpace: 'white-space'
	}
;

function Style(prop, style)
{
	this.$value = {};
	this.$style = style || {};

	if (prop)
		this.set(prop);
}

function getUnit(n)
{
	return typeof(n)==='string' ? n : (n ? n + 'px' : '0');
}

Style.prototype = {

	get elevation()
	{
		return this.$value.elevation;
	},

	set elevation(x)
	{
		this.$value.elevation = x;
		this.$style.zIndex = x;
		this.$style.boxShadow = x + 'px ' + x + 'px ' + (3*x)+'px rgba(0,0,0,0.26)';
	},

	set: function(styles)
	{
		for (var i in styles)
			this[i] = styles[i];
	},

	get translateX()
	{
		return this.$value.translateX;
	},

	get translateY()
	{
		return this.$value.translateY;
	},

	set translateX(x)
	{
		this.$value.translateX = x;
		this.$transform();
	},

	set translateY(y)
	{
		this.$value.translateY = y;
		this.$transform();
	},

	$transform: function()
	{
		this.$style.transform = 'translate(' + getUnit(this.$value.translateX) + ',' +
			getUnit(this.$value.translateY) + ')';
	},

	$toCSS: function()
	{
		var result = '', val;

		for (var i in this.$style)
		{
			val = this.$style[i];

			if (val!==null && val!==undefined && val!=='')
				result += (CSS[i] || i) + ': ' + this.$style[i] + ';';
		}

		return result;
	}

};

// Properties that accept percentages
([ 'top', 'left', 'right', 'bottom', 'marginTop','lineHeight',
	'marginLeft', 'marginRight', 'marginBottom', 'margin', 'height', 'width', 'flexBasis'
 ]).forEach(function(name) {

	Object.defineProperty(Style.prototype, name, {
		get: function() { return this.$value[name]; },
		set: function(val) {
			this.$value[name] = val;
			this.$style[name] = typeof(val)==='string' ? val : (val||0)+'px';
		}
	});

});

// Properties that require a Unit

([ 'paddingTop', 'paddingLeft', 'paddingRight', 'paddingBottom', 'fontSize',
  	'padding', 'outline', 'borderBottom', 'borderTop', 'borderLeft', 'borderRight',
  	'border', 'borderRadius', 'borderWidth'
 ]).forEach(function(name) {

	Object.defineProperty(Style.prototype, name, {
		get: function() { return this.$value[name]; },
		set: function(val) {
			this.$value[name] = val;
			this.$style[name] = val===null || val===undefined ? '' : (val||0)+'px';
		}
	});

});

([ 'display', 'position', 'boxShadow', 'opacity', 'fontFamily', 'fontWeight', 'borderColor',
  	'backgroundColor', 'backgroundImage', 'color', 'cursor', 'overflowX', 'overflowY',
  	'textDecoration', 'borderStyle', 'transition', 'textTransform', 'textAlign', 'flexGrow',
  	'alignContent', 'flexDirection', 'justifyContent', 'whiteSpace'
 ]).forEach(function(name) {

	Object.defineProperty(Style.prototype, name, {
		get: function() { return this.$value[name]; },
		set: function(val) {
			this.$value[name] = this.$style[name] = val;
		}
	});

});

function StyleSheet(meta)
{
	this.tagName = meta.name;
	this.$id = CID++;
	this.$classes = [];
	this.$selector = meta.shadow===false ? meta.name : ':host';

	// TODO
	for (var i in meta.styles)
		this.insertRule(i, meta.styles[i]);

	this.$attachStyle(meta);
	this.$render(this.$toCSS());
}

StyleSheet.prototype = {

	$attachStyle: function(meta)
	{
		if (meta.$template)
		{
			this.$native = document.createElement('STYLE');
			meta.$template.$content.appendChild(this.$native);
		} else
			this.$createTemplate(meta);
	},

	$createTemplate: function(meta)
	{
		var src = '<style></style>' + (meta.shadow!==false ? '<slot></slot>' : '');
		meta.$template = new cxl.dom.Template(src);
		this.$native = meta.$template.$content.childNodes[0];
	},

	$getMediaQuery: function(rule, minWidth, css)
	{
	var
		cls = rule ? '.'+rule : '',
		bp = BREAKPOINTS[minWidth] + 'px',
		sel = this.$selector
	;
		return '@media(min-width:' + bp + '){' + sel +
			(cls ? (cls + ',' + sel + ' ' + cls) : '') + '{' + css + '}}';
	},

	$getSelector: function(rule, css)
	{
		var i, state, selector = this.$selector;

		if (rule==='$')
			return selector + '{' + css + '}';

		if (rule==='*')
			return selector + ', ' + selector + ' *{' + css + '}';

		i = rule.indexOf('$');

		if (i!==-1)
		{
			state = rule.slice(i+1);
			rule = rule.slice(0, i);

			if (state==='small' || state==='medium' || state==='large' || state==='xlarge')
				return this.$getMediaQuery(rule, state, css);

			rule = rule ? '.' + rule + ':' + state : ':' + state;
		} else
			rule = '.' + rule;

		return (selector===':host' ? selector + '(' + rule + ')' :
			selector + rule) + ',' + selector + ' ' + rule + '{' + css + '}';
	},

	$renderGlobal: function()
	{
		var glob = cxl.dom.globalStyles;

		return glob && this.$toCSS(glob.$classes);
	},

	$render: function(css)
	{
		this.$native.innerHTML = this.$renderGlobal() + css;
	},

	$toCSS: function(classes)
	{
		var css='', i=0, style;

		classes = classes || this.$classes;

		for (;i<classes.length;i++)
		{
			style = classes[i];
			css += this.$getSelector(style.rule, style.style.$toCSS());
		}

		return css;
	},

	// Render styles needs to be called after insert styles.
	applyStyles: function()
	{
		this.$render(this.$toCSS());
	},

	insertRule: function(rule, styles)
	{
		var result = { rule: rule, style: new Style(Object.assign({}, styles)) };
		this.$classes.push(result);
		return result;
	}

};

Object.assign(cxl.dom, {

	Style: Style,
	StyleSheet: StyleSheet,

	globalStyles: new StyleSheet({ name: 'cxl-root' }),

	registerFont: function(fontFamily, src)
	{
		// TODO
		STYLES.sheet.insertRule('@font-face{font-family:' + fontFamily + ';src:url("' + src + '");}', 0);
	}

});

cxl.dom.globalStyles.$classes.push({ rule: '*', style: new Style(null, {
	'box-sizing': 'border-box',
	flexBasis: '100%'
})});

})(this.cxl);

(function(cxl) {

cxl.Undefined = {};
cxl.Skip = {};

var renderer = {

	pipeline: [],
	raf: null,

	digestBinding: function(b)
	{
		var newVal;

		if (b.digest)
		{
			newVal = b.digest();

			if (b.value !== newVal)
			{
				b.set(newVal);
				return true;
			}
		}
	},

	commitDigest: function(view)
	{
		var i, b = view.$bindings, changed=true, count=0;

		while (changed)
		{
			changed = false;

			if (count++>9)
				throw new Error("Max digest cycle iterations reached.");

			for (i=0; i<b.length; i++)
				if (this.digestBinding(b[i]))
					changed = true;
		}

		view.$dirty = false;
	},

	commit: function()
	{
		var view;

		while ((view=renderer.pipeline.shift()))
			if (typeof(view)==='function')
				view();
			else
				renderer.commitDigest(view);

		renderer.raf = null;
	},

	request: function()
	{
		if (this.raf)
			return;

		this.raf = cxl.dom.requestAnimationFrame(this.commit);
	},

	render: function(view)
	{
		this.pipeline.push(view);
		this.request();
	},

	digest: function(view)
	{
		if (!view.$dirty)
		{
			view.$dirty = true;
			this.pipeline.push(view);

			this.request();
		}
	},

	cancel: function()
	{
		cxl.dom.cancelAnimationFrame(this.raf);
	}

};

/**
 * Creates References and Bindings.
 */
function Compiler()
{
	this.directives = {};
}

Compiler.prototype = {

	directives: null,
	components: null,

	shortcuts: {
		'=': 'refval',
		'#': 'call'
	},

	bindRegex: /\s*([:|])?([^\w]|_)?([^\(:\s>"'=\|]+)(?:\(([^\)]+)\))?(:|\|)?/g,

	getRef: function(shortcut, name, param, el, component)
	{
	var
		directive = this.shortcuts[shortcut],
		ref, result
	;
		if (directive)
			param = name;
		else
			directive = name;

		ref = this.directives[directive];

		if (!ref)
			throw new Error('Directive "' + directive + '" not found.');

		result = ref(el, param, component);

		// Move this to element.
		if (result)
			result.clone = ref.bind(this, el, param, component);

		return result;
	},

	bindElement: function(el, b, refA, component)
	{
	var
		refB = this.getRef(b[2], b[3], b[4], el, component),
		twoway = b[1]===':',
		once = b[1]==='|'
	;
		if (once)
			refA.once = true;

		if (refA)
		{
			refA.subscribe(refB);

			if (twoway)
			{
				refB.subscribe(refA.clone());

				if (refB.output && el.$bindings)
					el.$bindings.push(refB);
				else
				{
					component.$bindings.push(refB);
					el.$parentBindings.push(refB);
				}
			}
		}
		else if (refB)
		{
			if (refB.output && el.$bindings)
				el.$bindings.push(refB);
			else
			{
				component.$bindings.push(refB);
				el.$parentBindings.push(refB);
			}
		}

		return b[5] && refB;
	},

	parseBinding: function(el, prop, component)
	{
	var
		parsed, index, previous
	;
		this.bindRegex.lastIndex = 0;
		while ((parsed = this.bindRegex.exec(prop)))
		{
			index = this.bindRegex.lastIndex;
			previous = this.bindElement(el, parsed, previous, component);
			this.bindRegex.lastIndex = index;
		}
	}

};

var compiler = new Compiler();

//TODO see if we can unpublish these
cxl.Compiler = Compiler;
cxl.renderer = renderer;
cxl.parseBinding = function(el, prop, owner)
{
	return compiler.parseBinding(el, prop, owner);
};

cxl.DirectiveObservable = function(el, param, component)
{
	this.element = el;
	this.parameters = param;
	this.component = component;

	if (this.initialize) this.initialize();
};

cxl.inherits(cxl.DirectiveObservable, cxl.rx.Observable, {

	digest: null,
	bindings: null,
	value: cxl.Undefined,
	subscriber: null,
	dirty: false,

	once: false,

	// Output directives also digest when the component associated with their element
	// digests
	output: false,

	__subscribe: function(subscriber)
	{
		this.subscriber = subscriber;
	},

	subscribe: function(subscriber, error, complete)
	{
		if (subscriber instanceof cxl.DirectiveObservable)
		{
			error = subscriber.error.bind(subscriber);
			complete = subscriber.complete.bind(complete);
			subscriber = subscriber.next.bind(subscriber);
		}

		return cxl.rx.Observable.prototype.subscribe.call(this, subscriber, error, complete);
	},

	listenTo: function(el, event, fn)
	{
	var
		b = this.bindings = this.bindings || [],
		subscriber = el.on(event, fn.bind(this))
	;
		b.push(subscriber);

		return subscriber;
	},

	complete: function()
	{
		if (this.subscriber)
			this.subscriber.complete();
		if (this.bindings)
			this.bindings.forEach(function(b) {
				b.unsubscribe();
			});
		if (this.destroy)
			this.destroy();

		this.digest = this.update = this.destroy = null;
	},

	error: function(e)
	{
		if (this.subscriber)
			this.subscriber.error(e);

		this.complete();
	},

	set: function(newVal)
	{
		this.value = newVal;

		if (this.component)
			cxl.renderer.digest(this.component);

		if (this.subscriber)
			this.subscriber.next(this.value);

		if (this.once)
			this.complete();
	},

	next: function(val)
	{
		var newVal;

		if (this.update)
			newVal = this.update(val);

		if (newVal===cxl.Skip)
			return;

		if (newVal instanceof cxl.Promise)
			newVal.then(this.set.bind(this));
		else
			this.set(newVal===undefined ? val : newVal);
	}

});

cxl.directive = function(name, Fn, shortcut)
{
	var directive = Fn;

	if (typeof(Fn)!=='function')
		Fn = cxl.extendClass(cxl.DirectiveObservable, Fn, null, name);

	if (Fn.prototype instanceof cxl.DirectiveObservable)
	{
		Fn.prototype.$$name = name;
		directive = function(el, p, c) { return new Fn(el, p, c); };
	}

	if (shortcut)
		compiler.shortcuts[shortcut] = name;

	return (compiler.directives[name] = directive);
};

cxl.pipe = function(name, update, digest)
{
	return cxl.directive(name, { update: update, digest: digest });
};

//
// DOM Directives
//
cxl.directive('show', {
	initialize: function() {
		this.element.inlineStyle.display = 'none';
	},
	update: function(value) {
		this.element.inlineStyle.display = value ? '' : 'none';
	}
});

cxl.directive('hide', {
	initialize: function() {
		this.element.inlineStyle.display = 'none';
	},
	update: function(value) {
		this.element.inlineStyle.display = value ? 'none' : '';
	}
});

/**
 * Runs Local Directive
 */
cxl.directive('call', {

	update: function(val)
	{
		var fn = this.component.get(this.parameters);
		return fn.call(this.component.$state, val, this.element);
	},

	digest: function()
	{
		return this.update(this.value);
	}

});

//
// Navigation
//
cxl.pipe('hash', function(val) {
	this.element.set('href', '#' + cxl.location.path(val));
});

//
// DOM Content Directives
//
cxl.directive('value', {

	output: true,

	initialize: function()
	{
		function onChange() {
			cxl.renderer.digest(this.component);
		}

		this.listenTo(this.element, 'change', onChange);
		this.listenTo(this.element, 'input', onChange);

		// Prevent value from digesting
		this.value = this.element.get('value');
	},

	update: function(val)
	{
		if (this.element.get('value')!==val)
			this.element.set('value', val);
	},

	digest: function()
	{
		return this.element.get('value');
	}

});

cxl.pipe('text', function(value)
{
	if (value===undefined || value===null)
		value = '';

	this.element.setContent(value);
});

cxl.pipe('insert', function(value) {
	this.element.insert(value);
});

//
// Marker Directives
//
function markerDirective(update)
{
	return {
		initialize: function() {
			this.marker = cxl.dom.marker('marker');
		},
		update: update
	};
}

cxl.directive('if', markerDirective(function(val) {
	if (val)
	{
		if (this.marker.parent)
		{
			this.marker.parent.insert(this.element, this.marker);
			this.marker.remove();
		}
	}
	else if (this.element.parent)
	{
		this.element.parent.insert(this.marker, this.element);
		this.element.remove();
	}
}));


cxl.directive('unless', markerDirective(function(val) {
	if (val)
	{
		if (this.element.parent)
		{
			this.element.parent.insert(this.marker, this.element);
			this.element.remove();
		}
	}
	else if (this.marker.parent)
	{
		this.marker.parent.insert(this.element, this.marker);
		this.marker.remove();
	}
}));

//
// DOM Events
// If callback passed, return false or a promise to stop event from
// firing
//
function EventDirective(el, param, comp) {
	if (this.event && param)
		this.callback = comp.get(param);
	else if (param)
		this.event = param;

	this.listenTo(el, this.event, this.onChange);

	cxl.DirectiveObservable.call(this, el, param, comp);
}

cxl.inherits(EventDirective, cxl.DirectiveObservable, {

	prevent: false,
	allowTrigger: false,
	callback: null,
	onStart: null,

	onDone: function(ev, result)
	{
		if (result !== false)
			// TODO see if this is safe
			this.next(ev);
	},

	update: function(val)
	{
		if (this.event && this.allowTrigger && val !== this.lastEvent)
			this.element.trigger(this.event);
	},

	onChange: function(ev)
	{
		var stop;

		if (this.callback)
			stop = this.callback.call(this.component.$state, ev);

		if (this.prevent)
			ev.preventDefault();

		this.lastEvent = ev;

		if (stop)
			stop.then(this.onDone.bind(this, ev));
		else if (stop !== false)
			this.onDone(ev);
	}

});


/**
 * Binds to View DOM element event.
 */
cxl.directive('on', EventDirective);

cxl.directive('click', cxl.extendClass(EventDirective, {
	event: 'click', prevent: true, allowTrigger: true
}, null, 'click'));

cxl.directive('change', cxl.extendClass(EventDirective, {
	event: 'change', prevent: true, allowTrigger: true
}, null, 'change'));

cxl.directive('blur', cxl.extendClass(EventDirective, { event: 'blur' }));
cxl.directive('focus', cxl.extendClass(EventDirective, {
	event: 'focus', allowTrigger: true,
	update: function() {
		this.element.focus();
	}
}, null, 'focus'));

cxl.directive('keypress', {

	initialize: function()
	{
		var handler = cxl.debounce(this.onKeyPress);
		this.listenTo(this.element, 'keydown', handler);
	},

	onKeyPress: function(ev)
	{
		if (!this.parameters || ev.key.toLowerCase()===this.parameters.toLowerCase())
			this.set(ev);
	}

});

/**
 * Must be attached to form.
 */
cxl.directive('submit', cxl.extendClass(EventDirective, {
	event: 'submit', prevent: true
}, null, 'submit'));

cxl.directive('prevent', {
	update: function(ev) {
		ev.preventDefault();
	}
});

cxl.directive('stop', {
	update: function(ev) {
		ev.stopPropagation();
	}
});

cxl.pipe('refval', function(val) {
	this.component.set(this.parameters, val);
}, function() {
	return this.component.get(this.parameters);
});

cxl.directive('bool', {
	update: function(val) {
		return val!==undefined && val!==null && val!==false;
	}
});

cxl.directive('checked', {

	update: function(val) {
	var
		value = this.element.get('value'),
		/* jshint eqeqeq:false */
		result = val==value
	;
		this.element.set('checked', result);
	},

	digest: function()
	{
		var checked = this.element.get('checked');

		return checked ? this.element.get('value') || 'on' : false;
	}

});

cxl.directive('set', {
	update: function(val)
	{
		this.element.set(this.parameters, val);
	}
});

cxl.directive('style', {

	update: function(val) {
		if (this.parameters)
			this.element.setStyle(this.parameters, !!val);
		else
			this.element.setStyle(val);
	},

	digest: function()
	{
		this.element.setStyle(this.parameters, true);
		this.digest = null;
	}

});

cxl.pipe('style.inline', function(val) {
	this.element.inlineStyle[this.parameters] = val;
});

cxl.pipe('element', function() {
	return this.element;
});

cxl.directive('get', {

	output: true,

	update: function(val)
	{
		// TODO should we skip if val is falsy?
		return val && val.get(this.parameters) || null;
	},

	digest: function() {
		return this.element.get(this.parameters);
	}

});

cxl.directive('getset', {
	output: true,
	update: function(val)
	{
		this.element.set(this.parameters, val);
	},
	digest: function()
	{
		return this.element.get(this.parameters);
	}
}, '@');

cxl.pipe('emit', function() {
	this.component.trigger(this.parameters);
});

//
// Logical Directives
//
cxl.directive('true', {
	next: function(val) {
		if (val)
			this.set(val);
	}
});

cxl.pipe('replace', function(val) {
	return cxl.replaceParameters(this.parameters, typeof(val)==='object' ? val : { $: val });
}, function() {
	// TODO should we access state directly? ...
	return cxl.replaceParameters(this.parameters, this.component.$state);
});

cxl.directive('compile', {

	initialize: function() {
		if (this.element.tagName!=='CXL-FRAGMENT')
			throw "Invalid element.";
	},

	update: function() {
		return this.element.template.compile(this.component);
	}

});

cxl.directive('repeat', {

	items: null,
	index: 0,

	initialize: function()
	{
		if (this.element.tagName!=='CXL-FRAGMENT')
			throw "Invalid element.";

		this.each = this.each.bind(this);
	},

	each: function(item, key)
	{
		this.component.$item = { item: item, key: key, index: this.index++ };

		var el = this.element.template.compile(this.component);

		el.insertTo(this.element);

		if (this.subscriber)
			this.subscriber.next(item);
	},

	clear: function()
	{
		this.element.empty();
	},

	set: function(val)
	{
		if (this.value)
			this.clear();

		this.value = val;
		this.index = 0;

		cxl.each(val, this.each);

		if (this.once)
			this.complete();
	},

	digest: function()
	{
		return this.component.get(this.parameters);
	}
});

cxl.directive('key', {
	initialize: function() {
		this.item = this.component.$item;
	},

	update: function()
	{
		return this.item.key;
	},

	digest: function() {
		return this.item.key;
	}
});

cxl.directive('index', {

	initialize: function() {
		this.item = this.component.$item;
	},

	update: function()
	{
		return this.item.index;
	},

	digest: function() {
		return this.item.index;
	}

});

cxl.directive('itemref', {
	initialize: function()
	{
		this.item = this.component.$item;
	},
	update: function() {
		return this.item;
	},
	digest: function() {
		return this.item;
	}
});

cxl.directive('item', {
	initialize: function() {
		this.item = this.component.$item;
	},
	update: function(val)
	{
		if (this.parameters)
			this.item.item[this.parameters] = val;
	},
	digest: function()
	{
		var item = this.item.item;
		return this.parameters ? item[this.parameters] : item;
	}
});

cxl.directive('each', {

	index: 0,

	initialize: function()
	{
		this.each = this.each.bind(this);
	},

	each: function(item, key)
	{
		this.component.$item = { item: item, index: this.index++, key: key };
		this.subscriber.next(item);
	},

	set: function(val)
	{
		this.value = val;
		this.index = 0;

		if (this.subscriber)
			cxl.each(val, this.each);

		if (this.once)
			this.complete();
	},

	digest: function() {
		return this.component.get(this.parameters);
	}

});

cxl.directive('collection', {

	set: function(val)
	{
		this.originalValue = val;

		if (!(val instanceof cxl.rx.Collection))
			val = Array.isArray(val) ? new cxl.rx.Collection(val) : new cxl.rx.ObjectCollection(val);

		if (this.unsubscribeCollection)
		{
			this.value.empty();
			this.unsubscribeCollection.unsubscribe();
		}

		this.value = val;

		this.unsubscribeCollection = val.subscribe(this.onEvent.bind(this));

		if (this.once)
			this.complete();
	},

	onEvent: function(event)
	{
		if (this.subscriber)
			this.subscriber.next(event);
	},

	digest: function()
	{
		var newVal = this.component.get(this.parameters);

		return newVal===this.originalValue ? this.value : newVal;
	}

});

cxl.directive('filter', {

	set: function(newVal)
	{
		var result = this.component.get(this.parameters)(newVal);

		if (result)
			cxl.DirectiveObservable.prototype.set.call(newVal);
	}

});

cxl.directive('list.reverse', {
	count: 0,
	update: function(ev) {
		ev.index = this.count-ev.index;

		if (ev.event==='child_added')
			this.count++;
		else if (ev.event==='child_removed')
			this.count--;
	}
});

cxl.directive('list', {

	initialize: function()
	{
		if (this.element.tagName!=='CXL-FRAGMENT')
			throw "Invalid element.";

		this.nodes = [];
	},

	compile: function(record)
	{
		this.component.$item = record;

		return this.element.template.compile(this.component);
	},

	updateIndex: function()
	{
		// TODO optimize?
		this.nodes.forEach(function(record, i) {
			record.index = i;
		});
	},

	add: function(item, key, index)
	{
	var
		nextNode = this.nodes[index],
		record = { item: item, key: key, index: index },
		el = this.compile(record)
	;
		record.nodes = el;

		if (nextNode)
			this.nodes.splice(index, 0, record);
		else
			this.nodes.push(record);

		this.updateIndex();

		el.insertTo(this.element, nextNode && nextNode.nodes.child(0));
	},

	remove: function(index)
	{
		var el = this.nodes[index];

		this.nodes.splice(index, 1);
		this.updateIndex();

		el.nodes.each(function(n) {
			this.element.removeChild(n);
			// TODO
			n.destroy();
		}, this);
	},

	update: function(event)
	{
		if (event.event==='child_added')
			this.add(event.item, event.key, event.index);
		else if (event.event==='child_removed')
			this.remove(event.index);
	}

});

cxl.pipe('date', function(val) {
	
	if (val instanceof cxl.date.DateRange)
		return val.toString();
		
	if (!(val instanceof cxl.date.Date))
		val = new Date(val);

	return val.toLocaleDateString();
});

cxl.pipe('time', function(val) {
	if (!(val instanceof Date))
		val = new Date(val);

	return val.toLocaleTimeString();
});

cxl.directive('resize', {

	initialize: function()
	{
		this.listenTo(cxl.dom.root, 'resize', this.onResize);
	},

	onResize: function(ev)
	{
		this.next(ev);
	}

});

cxl.directive('timer', {

	initialize: function()
	{
		this.interval = this.parameters ?
			this.component.get(this.parameters) : 1000;
		this.value = 0;
	},

	destroy: function()
	{
		clearInterval(this.__interval);
	},

	onInterval: function()
	{
		this.set(this.value+1);
	},

	digest: function()
	{
		this.__interval = setInterval(
			this.onInterval.bind(this), this.interval);
		
		this.digest = null;
		
		return this.value;
	}

});

cxl.directive('id', function(el, param, component) {
	component.set(param, el);
});

cxl.directive('drag', {
	initialize: function() {

		var sx, sy, ox, oy, drag, el=this.element;

		function onDragStart(ev)
		{
			if (!drag)
			{
				drag = true;
				sx = el.rect.left;
				sy = el.rect.top;
				ox = ev.x - sx;
				oy = ev.y - sy;
			}
		}

		function onDrag(ev)
		{
			if (drag)
			{
				el.inlineStyle.translateX = ev.x - ox;
				el.inlineStyle.translateY = ev.y - oy;
			}
		}

		function onDragStop()
		{
			if (drag)
			{
				el.inlineStyle.translateX = 0;
				el.inlineStyle.translateY = 0;
				drag = false;
			}
		}

		this.listenTo(el, 'mousedown', onDragStart);
		this.listenTo(el, 'mousemove', onDrag);
		this.listenTo(el, 'mouseup', onDragStop);
	}
});

/**
 * Sets element attribute value
 */
cxl.directive('attribute', {

	update: function(val)
	{
		var el = this.element.$native;

		if (val===false || val===null || val===undefined)
			val = null;
		else if (val===true)
			val = "";
		else
			val = val.toString();

		if (val===null)
			el.removeAttribute(this.parameters);
		else
			el.setAttribute(this.parameters, val);

		return val;
	}

});

cxl.directive('state', {

	digest: function() {
		return this;
	}

});

cxl.directive('content', {

	initialize: function()
	{
		var slot = this.slot = document.createElement('SLOT'), sel;

		if (this.parameters)
		{
			sel = slot.name = this.parameters;

			// Initialize children slots
			this.component.childNodes.each(function(child) {
				if (child.matches(sel))
					child.$native.slot = sel;
			});
		}

		this.component.slots.push(this);
		this.element.$native.appendChild(slot);
	},

	parameters: ''

});

cxl.directive('location', {
	initialize: function()
	{
		this.bindings = [ cxl.location.subscribe(this.next.bind(this)) ];
	}
});

})(this.cxl);


(function(cxl) {

function RGBA(r, g, b ,a)
{
	this.r = r;
	this.g = g;
	this.b = b;
	this.a = a;
}

cxl.theme = {

	RGBA: RGBA,
	rgb: function(r, g, b)
	{
		return new RGBA(r, g, b);
	},

	spacer: 16,
	navbarHeight: 56,
	// Animation speed
	speed: '0.25s',

	primary: '#009688',
	primaryLight: '#52c7b8',
	primaryDark: '#00675b',

	secondary: '#ff5722',
	secondaryLight: '#ffc947',
	secondaryDark: '#c66900',

	disabled: 'rgb(224,224,224)',
	backdrop: 'rgba(0,0,0,0.26)',

	danger: '#ff1744',
	success: '#4caf50',

	textColor: '#333',
	textSubtitle: '#999',
	textInverse: '#f5f5f5',
	textDisabled: 'rgba(0,0,0,0.26)',

	borderColor: '#ccc',

	// TODO
	grayDark: '#333',
	gray: '#bbb',
	grayLighter: '#ddd',
	white: '#eee'
};

})(this.cxl);

(function(cxl) {
"use strict";

cxl.ui = {};

var css = cxl.theme;

cxl.dom.globalStyles.insertRule('*', {
	transition: ('opacity $speed, box-shadow $speed, border-color $speed, width $speed,' +
		'background-color $speed, top $speed, left $speed, right $speed, bottom $speed,' +
		'transform $speed').replace(/\$speed/g, css.speed)
});

cxl.dom.registerFont('FontAwesome', 'https://maxcdn.bootstrapcdn.com/font-awesome/4.7.0/fonts/fontawesome-webfont.woff?v=4.7.0');

cxl.dom.globalStyles.insertRule('$', { flexGrow: 1, display: 'block' });

cxl.component({
	name: 'cxl-avatar',
	attributes: [ 'big', 'src' ],
	bindings: [ '=big:style(big)' ],
	template: '<img &="style(image) =src:if:attribute(src)" />' +
		'<cxl-icon icon="user" &="style(image) =src:unless"></cxl-icon>',
	styles: {
		$: {
			borderWidth: 1, borderStyle: 'solid', borderRadius: 32, borderColor: css.gray,
			width: 40, height: 40, display: 'inline-block'
		},
		big: { width: 64, height: 64 },
		image: { width: 62, height: 62, fontSize: 48, textAlign: 'center', lineHeight: 62 }
	}

});

cxl.component({
	name: 'cxl-button',
	attributes: [ 'disabled', 'primary', 'flat', 'secondary' ],
	bindings: [ '=disabled:style(disabled) =primary:style(primary) =flat:style(flat) =secondary:style(secondary) =tabindex:attribute(tabindex)' ],
	styles: {
		$: {
			elevation: 1, paddingTop: 8, paddingBottom: 8, lineHeight: 20, paddingRight: 8,
			paddingLeft: 8, cursor: 'pointer', display: 'inline-block', textTransform: 'uppercase',
			borderRadius: 2
		},

		$focus: { elevation: 3, outline: 0 },

		primary: { backgroundColor: css.primary, color: css.textInverse },
		secondary: { backgroundColor: css.secondary, color: css.textInverse },
		disabled: { color: css.textDisabled, backgroundColor: css.disabled },
		flat: { elevation: 0, color: css.primary, fontWeight: '500' },
		flat$focus: { elevation: 3 }
	}
}, {
	tabindex: 0
});

cxl.component({
	name: 'cxl-card',
	styles: { $: { elevation: 1, marginBottom: 16 } }
});

cxl.component({
	name: 'cxl-card-block',
	attributes: [ 'inverse' ],
	bindings: [ '=inverse:style(inverse)'],
	styles: {
		$: { padding: 16 },
		inverse: { color: css.textInverse }
	}
});

cxl.component({
	name: 'cxl-card-title',
	attributes: [ 'big' ],
	bindings: [ '=big:style(big)' ],
	styles: {
		$: { fontSize: 16, fontWeight: 'bold', lineHeight: 20 },
		big: { fontSize: 24, paddingBottom: 8 }
	}
});
	
cxl.component({
	name: 'cxl-card-actions',
	styles: {
		$: { padding: 8 }
	}
});

cxl.component({
	name: 'cxl-card-subtitle',
	styles: {
		$: { fontSize: 16, color: css.textSubtitle, lineHeight: 20, marginTop: 8 }
	}
});
	
cxl.component({
	name: 'cxl-checkbox',
	template: '<label>' +
		'<input type="checkbox" &="=checked:|attribute(checked) get(checked):=checked:#onChange" />' +
		'<span &="content"></span></label>',
	attributes: [ 'checked', 'true-value', 'false-value', 'value' ]
}, {
	checked: false,
	'true-value': true,
	'false-value': false,

	onChange: function()
	{
		this.value = this[this.checked ? 'true-value' : 'false-value'];
	}
});
	
cxl.component({
	name: 'cxl-container',
	styles: {
		$: { padding: css.spacer },
		$large: { padding: 2*css.spacer },
	},
	shadow: false
});
	
cxl.component({
	name: 'cxl-content',
	styles: {
		$: {
			position: 'absolute', top: css.navbarHeight,
			overflowX: 'hidden', overflowY: 'auto',
			left: 0, right: 0, bottom: 0
		},
		$large: {
			left: 288
		}

	}
});

cxl.component({
	name: 'cxl-fab',
	styles: {
		$: {
			elevation: 1, backgroundColor: css.secondary, color: css.textInverse,
			position: 'fixed', width: css.navbarHeight, height: 56, bottom: 16, right: 24,
			borderRadius: 56, textAlign: 'center', paddingTop: 20, cursor: 'pointer',
			fontSize: 20, paddingBottom: 20, lineHeight: 16
		},
		$small: { top: css.navbarHeight/2, bottom: '' },
		$hover: { elevation: 3 }
	}
});

cxl.component({
	name: 'cxl-header',
	styles: {
		$: {
			height: css.navbarHeight, lineHeight: css.navbarHeight, backgroundColor: css.primary,
			color: css.textInverse, elevation: 2
		},
		$large: { marginLeft: 288 }
	}
});
	
cxl.component({
	name: 'cxl-form',
	bindings: [ 'on(validity):#onValidity on(cxl-form.submit):#onSubmit keypress(ENTER):#onSubmit']
}, {
	constructor: function()
	{
		this.invalid = [];
	},

	invalid: null,

	onValidity: function(ev)
	{
	var
		el = ev.target,
		i = this.invalid.indexOf(el),
		valid = el.validity.valid
	;
		if (valid && i!==-1)
			this.invalid.splice(i, 1);
		else if (!valid && i===-1)
			this.invalid.push(el);
	},

	onSubmit: function(ev)
	{
		if (this.invalid.length===0)
			this.$component.trigger('submit');
		else
		{
			this.invalid.forEach(function(a) {
				a.set('touched', true);
			});
			this.invalid[0].focus();
		}

		ev.stopPropagation();
	}
});

	
/**
 * Directive for navigation bars. Handles hiding when a new route
 * is activated and when clicking outside box.
 */
cxl.component({
	name: 'cxl-header-nav',
	template:
		'<div &="style(backdrop) on(click):#onClick =visible:style(visible) location:call(onRoute)">' +
		'<div &="style(drawer) on(click):stop">' +
		'<div &="content(cxl-profile)"></div>' +
		'<div &="style(content) content(cxl-nav-item, cxl-hr)">' +
		'</div></div></div>' +
		'<button &="click(collapse) style(toggler)" type="button">' +
		'<cxl-icon icon="bars"></cxl-icon></button>',
	styles: {
		$: { display: 'inline-block' },
		toggler: {
			backgroundColor: 'transparent', border: 0, marginLeft: 16, padding: 0, fontSize: 18,
			width: 16, marginRight: 16, color: css.textInverse, cursor: 'pointer', display: 'inline-block',
			marginTop: 16
		},
		toggler$large: { display: 'none' },

		backdrop: {
			position: 'fixed', top: 0, left: 0, bottom: 0, right: 0, backgroundColor: 'rgba(0,0,0,0.2)',
			elevation: 5, display: 'none'
		},
		backdrop$large: {
			display: 'block', right: 'auto', width: 288, elevation: 1
		},
		visible: { display: 'block' },

		drawer: {
			backgroundColor: '#fff', position: 'absolute', top: 0, left: 0, width: '85%', bottom: 0,
			overflowY: 'auto'
		},
		drawer$small: { width: 288 },
		content: { paddingTop: 8 }
	}
}, {

	visible: false,
	collapse: function() { this.visible = !this.visible; },

	onRoute: function()
	{
		this.visible=false;
	},

	onClick: function()
	{
		this.collapse();
	}

});

cxl.component({
	name: 'cxl-hr',
	shadow: false,
	styles: { $: {
		border: 0, borderBottom: 1,
		borderColor: css.borderColor, borderStyle: 'solid' }
	}
});

cxl.component({
	name: 'cxl-icon',
	template: '<link rel="stylesheet" href="https://maxcdn.bootstrapcdn.com/font-awesome/4.7.0/css/font-awesome.min.css">' +
		'<i &="=icon:replace(fa fa-:$):attribute(class) =spin:style(fa-spin)' +
		' =pulse:style(fa-pulse) =size:style.inline(fontSize) style(icon)"></i>',
	attributes: [ 'icon', 'spin', 'pulse', 'size' ],
	styles: {
		$: { fontFamily: 'FontAwesome', display: 'inline-block' },
		icon: { lineHeight: 'inherit' }
	}
});

cxl.component({
	name: 'cxl-item',
	styles: {
		$: { padding: 12, paddingLeft: 16, paddingRight: 16 }
	}
});
	
cxl.component({
	name: 'cxl-label',
	styles: { $: { fontSize: 12, lineHeight: 16 } }
});
	
cxl.component({
	name: 'cxl-loading',
	template: '<cxl-icon &="timer(delay):|show" icon="spinner" spin pulse size="64"></cxl-icon>',
	shadow: false,
	styles: { $: { textAlign: 'center', color: css.primary }}
}, {
	delay: 300
});
	
cxl.component({
	name: 'cxl-nav-item',
	template: '<a &="=href:true|set(href) style(link) =active:style(active)">' +
		'<cxl-icon &="=icon:set(icon) style(icon)"></cxl-icon>' +
		'<span &="content"></span></a>',
	bindings: [ '=active:style(active)' ],
	attributes: [ 'href', 'icon', 'active' ],
	styles: {
		$: { cursor: 'pointer' },
		link: {
			color: css.grayDark, textDecoration: 'none', display: 'block',
			lineHeight: 48, paddingRight: 16, paddingLeft: 16
		},
		icon: { marginRight: 16, width: 40, color: css.gray },
		link$hover: { color: css.primary },
		active: { color: css.primary, backgroundColor: css.grayLighter }
	}
});

	
cxl.component({
	name: 'cxl-radio',
	attributes: [ 'name', 'disabled', 'value', 'checked' ],
	template: '<label><input &="=name|attribute(name) =disabled|attribute(disabled) ' +
		'=value|attribute(value) =checked|bool|set(checked) change:element:get(checked):=checked"' +
		'type="radio"><span &="content"></span></label>'
});

cxl.component({
	name: 'cxl-radio-group',
	content: function(comp) {
		comp.childNodes.query('cxl-radio', function(e) {
			cxl.dom.parseBinding(e, '=name|set(name) =value:checked get(checked):true:element:get(value):=value', comp);
		});
	},
	attributes: [ 'value' ]
}, function()
{
	this.name = this.name;
});

cxl.component({
	name: 'cxl-submit',
	extend: 'cxl-button',
	attributes: [ 'disabled', 'primary', 'flat', 'secondary', 'icon', 'iconPulse', 'submitting' ],
	template: '<cxl-icon &="=submitting:if =icon:set(icon) =iconPulse:set(pulse)"></cxl-icon>' +
		' <span &="content"></span>',
	bindings: ['click:emit(cxl-form.submit) =submitting:=disabled']
}, {
	primary: true,
	submitting: false,
	icon: 'spinner',
	iconPulse: true
});
	
cxl.component({
	name: 'cxl-switch',
	template: '<input type="checkbox" &="style(input) =checked:|attribute(checked) get(checked):=checked:#onChange change(onChange)" />',
	attributes: [ 'checked', 'true-value', 'false-value', 'value' ],
	styles: {
		$: { display: 'inline-block', paddingLeft: 12 }
	}
}, {
	'true-value': true,
	'false-value': false,

	onChange: function()
	{
		this.value = this[this.checked ? 'true-value' : 'false-value'];
	}
});

cxl.component({
	name: 'cxl-tabs',
	bindings: [ 'on(active):#setActive' ],
	styles: {
		$: {
			backgroundColor: css.primary, color: css.textInverse,
			border: 0, display: 'flex', elevation: 1
		},
		$small: { display: 'block' }
	}
}, {

	selected: null,
	setActive: function(ev)
	{
		// TODO see if we can achieve this without accessing the component.
		if (ev.target.get('active'))
			this.$component.childNodes.each(function(tab) {
				if (tab.tagName==='cxl-tab')
				{
					if (tab !== ev.target)
						tab.set('active', false);
					else
						this.selected = tab;
				}
			}, this);
	}

});

cxl.component({
	name: 'cxl-tab',
	template: '<a &="style(link) =href:set(href) =active:emit(active):style(active) content"></a>',
	attributes: ['href', 'active'],
	styles: {
		$small: { display: 'inline-block' },
		link: {
			padding: 16, paddingBottom: 12, border: 0, borderBottom: 4, borderColor: 'transparent',
			textTransform: 'uppercase', fontSize: 14, color: css.textInverse, lineHeight: 20,
			textDecoration: 'none', borderStyle: 'solid', textAlign: 'center', display: 'block'
		},
		active: { borderColor: css.secondary, color: css.textInverse }
	}
});

cxl.component({
	name: 'cxl-tabs-content',
	styles: {
		$: { position: 'absolute', top: 52, left: 0, bottom: 0, right: 0, overflowY: 'auto' }
	}
});

cxl.component({
	name: 'cxl-input-static',
	shadow: false,
	styles: {
		// TODO
		$: { marginTop: 34 }
	}
});

cxl.component({
	name: 'cxl-input',
	attributes: [ 'value', 'readonly', 'disabled', 'required', 'autofocus', 'touched', 'inverse' ],
	template: '<input &="id(input) =required:attribute(required) =type:|attribute(type)' +
		' style(input) =value::value =readonly:style(readonly):attribute(readonly)' +
		' =disabled:attribute(disabled) #isInvalid:style(invalid) =inverse:style(inverse)' +
		' on(blur):#onBlur:emit(blur) =autofocus:attribute(autofocus) on(focus):#onFocus" />' +
		'<div &="style(focus) =invalid:style(invalid) =focused:style(expand)"></div>',
	bindings: [ '=touched:true:emit(touched) on(validity):#onValidity' ],
	styles: {
		$: { marginBottom: 8 },
		input: {
			fontSize: 16, border: 0, height: 32, backgroundColor: 'transparent',
			width: '100%', paddingTop: 6, paddingBottom: 6, lineHeight: 20,
			borderBottom: 1, borderColor: css.grayDark, borderStyle: 'solid'
		},
		input$focus: { outline: 0, borderColor: css.primary },
		//input$hover: { borderBottom: 2, borderStyle: 'solid' },
		inverse: { borderColor: css.white, color: css.white },
		inverse$focus: { borderColor: css.primary },
		readonly: { borderStyle: 'dashed' },
		focus: {
			position: 'relative', border: 0, borderTop: 2, borderStyle: 'solid',
			borderColor: css.primary, left: '50%', width: 0, top: -1
		},
		expand: { left: 0, width: '100%' },
		invalid: { borderColor: css.danger },
		invalid$focus: { borderColor: css.danger }
	},
	ready: function(state)
	{
		this.focus = state.focus.bind(state);
	}
}, {
	value: '',
	type: 'text',
	touched: false,

	isInvalid: function()
	{
		return this.touched && this.invalid;
	},

	onValidity: function()
	{
		this.invalid = !this.$component.validity.valid;
	},

	onFocus: function()
	{
		this.focused = true;
	},

	onBlur: function()
	{
		if (!this.touched)
		{
			this.touched = true;
			this.$component.trigger('touched');
		}
		this.focused = false;
	},

	focus: function()
	{
		this.input.focus();
	}
});
	
cxl.component({
	name: 'cxl-textarea',
	extend: 'cxl-input',
	template: '<div &="id(span) style(input) style(measure)"></div>' +
		'<textarea &="id(textarea) =type:|attribute(type) =required:attribute(required) style(input) style(textarea) ' +
		'=value::value value:#calculateHeight =readonly:attribute(readonly) =disabled:attribute(disabled) content" ></textarea>',
	styles: {
		$: { marginBottom: 8, marginTop: css.spacer/2, position: 'relative' },
		input: {
			fontSize: 16, border: 1, backgroundColor: 'transparent',
			width: '100%', lineHeight: 20, padding: css.spacer,
			borderBottom: 1, borderColor: css.grayDark, borderStyle: 'solid',
			fontFamily: 'inherit'
		},
		textarea: {
			position: 'absolute', top: 0, left: 0, right: 0, bottom: 0
		},
		input$focus: { outline: 0, borderColor: css.primary },
		//input$hover: { borderBottom: 2, borderStyle: 'solid' },
		inverse: { borderColor: css.white, color: css.white },
		inverse$focus: { borderColor: css.primary },
		readonly: { borderStyle: 'dashed' },
		invalid: { borderColor: css.danger },
		invalid$focus: { borderColor: css.danger },
		// TODO move to textarea when inheritance works
		measure: { opacity: 0, whiteSpace: 'pre-wrap' }
	},
	ready: function(state)
	{
		setTimeout(state.calculateHeight.bind(state));
	}

}, {
	// Element Used to Calculate Height
	span: null,
	
	calculateHeight: function()
	{
		this.span.setContent(this.textarea.get('value') + '&nbsp;');
	}
});
	
cxl.component({
	name: 'cxl-search-input',
	template: '<cxl-icon icon="search" &="style(icon)"></cxl-icon>' +
		'<input &="value:=value style(input)" placeholder="Search"></input>',
	styles: {
		$: { elevation: 1, position: 'relative', padding: css.spacer, paddingBottom: 14, fontSize: 18 },
		icon: { position: 'absolute', top: css.spacer+2, color: css.grayLighter },
		input: {
			outline: 0, border: 0, width: '100%',
			lineHeight: 24, padding: 0, paddingLeft: 48, fontSize: 18
		}
	}
});

cxl.component({
	name: 'cxl-password',
	extend: 'cxl-input'
}, {
	type: 'password'
});

cxl.component({
	name: 'cxl-form-group',
	styles: {
		$: { paddingTop: css.spacer },
		feedback: { color: css.danger, fontSize: 12 },
		error: { color: css.danger, borderColor: css.danger }
	},
	template: '<div &="content on(invalid):#update"></div>' +
		'<div &="style(feedback) =error:text"></div>',
	bindings: [ 'on(touched):#update on(validity):#update =invalid:style(error)' ]
}, {

	update: function(ev)
	{
		var el = ev.target;

		if (el.get('touched'))
		{
			this.invalid = !el.validity.valid;
			this.error = el.validity.message;
		}
	}

});

cxl.component({
	name: 'cxl-row',
	styles: {
		$: { marginLeft: -8, marginRight: -8 },
		$small: { display: 'flex' }
	}
});

cxl.component({
	name: 'cxl-col',
	styles: {
		$: { marginLeft: 8, marginRight: 8, width: '100%' }
	}
});

cxl.component({
	name: 'cxl-header-title',
	shadow: false,
	styles: {
		$: { display: 'inline', fontSize: 18, marginLeft: 16 }
	}
});

cxl.component({
	name: 'cxl-breadcrumbs',
	bindings: [ 'route:#getTitle' ]
}, {
	getTitle: function(route) {
		var html, hash = cxl.location.hash, link;

		if (this.$component.childNodes.length)
			this.$component.childNodes.each(function(node) {
				node.destroy();
			});

		this.$component.empty();

		do {
			if ((link=route.$meta.link)) {
				// TODO use state?
				link = cxl.replaceParameters(link, route.$state);
			} else
			{
				link = hash.match(route.$meta.regex);
				link = link && link[0];
			}

			html = cxl.html('<span &="=title:if">' +
				(link ?
				 	'<a &="=title:text" href="#' + link + '"></a>' :
				 	'<x &="=title:text"></x>') +
				'</span>', route);

			this.$component.insert(html, this.$component.child(0));

		} while ((route = route.$owner) && route !== cxl.dom.root);
	}
});

cxl.component({
	name: 'cxl-header-menu',
	bindings: [ 'click:#toggle' ],
	template: '<cxl-icon icon="ellipsis-v"></cxl-icon>' +
		'<div &="style(backdrop) click:stop:#toggle =opened:if">' +
		'<cxl-menu dense &="style(menu) content"></cxl-menu></div>',
	styles: {
		$: { position: 'fixed', right: 16, top: 16, color: css.textInverse, cursor: 'pointer' },
		backdrop: { position: 'fixed', right:0, top:0, left:0, bottom: 0 },
		menu: { position: 'absolute', right: 16, top: 16 }
	}
}, {
	opened: false,
	toggle: function() {
		this.opened = !this.opened;
	}
});

cxl.component({
	name: 'cxl-menu',
	styles: {
		$: {
			elevation: 1, display: 'inline-block', paddingTop: 8, paddingBottom: 8,
			backgroundColor: '#fff', overflowY: 'auto', color: css.textColor
		},
		dense: { paddingTop: 0, paddingBottom: 0 }
	},
	attributes: [ 'dense' ],
	bindings: [ '=dense:style(dense)' ]
});

cxl.component({
	name: 'cxl-modal',
	template: '<div &="style(content) content"></div>',
	bindings: [ '=hidden:attribute(hidden) click($component.remove)' ],
	styles: {
		$: {
			backgroundColor: css.backdrop, position: 'fixed', top: 0, bottom: 0, left: 0, right: 0,
			elevation: 5
		},

		content: {
			backgroundColor: '#fff', position: 'absolute', top: 0, left: 0, right: 0, bottom: 0
		},
		content$small: {
			elevation: 2, translateY: '-50%', top: '50%', bottom: 'auto',
			width: '80%', marginLeft: 'auto', marginRight: 'auto'
		},
		footer: { textAlign: 'right' }
	}
}, {
	hidden: false,
	template: null
});

cxl.component({
	name: 'cxl-modal-alert',
	template: '<cxl-modal>' +
		'<cxl-card-block>' +
		'<cxl-card-title &="=title:if:text"></cxl-card-title>' +
		'<p &="=message:text"></p></cxl-card-block><cxl-card-block>' +
		'<cxl-button flat &="=action:text click:#remove:#resolve"></cxl-button></cxl-card-block></cxl-modal>',
	initialize: function(state) {
		state.promise = new cxl.Promise(function(resolve, reject) {
			state.resolve = resolve;
			state.reject = reject;
		});
	}
}, {
	action: 'Ok',
	remove: function()
	{
		this.$component.remove();
	}
});

cxl.component({
	name: 'cxl-confirm',
	template: '<cxl-modal>' +
		'<cxl-card-block>' +
		'<cxl-card-title &="=title:if:text"></cxl-card-title>' +
		'<p &="=message:text"></p></cxl-card-block>' +
		'<cxl-card-block &="style(footer)"><cxl-button flat &="click:#remove:#reject">Cancel</cxl-button> ' +
		'<cxl-button flat &="=action:text click:#remove:#resolve"></cxl-button></cxl-card-block></cxl-modal>',
	extend: 'cxl-modal-alert',
	styles: {

	}
}, {
	action: 'Confirm'
});

cxl.component({
	name: 'cxl-option',
	attributes: [ 'value', 'selected', 'disabled' ],
	bindings: [ 'on(click):stop:emit(itemSelected) =selected:style(selected) =disabled:style(disabled)'],
	styles: {
		$: { padding: 16, paddingRight: 40 },
		disabled: { color: css.textDisabled },
		selected: { backgroundColor: '#ccc' }
	}
}, {
	value: null,
	selected: false
});

cxl.component({
	name: 'cxl-multiselect',
	template: '<cxl-menu &="id(menu) =opened:if content(cxl-option, cxl-optgroup)"></cxl-menu>' +
		'<span &="=label:text"></span>',
	attributes: [ 'label', 'tabindex', 'disabled', 'selected', 'value' ],
	bindings: [ 'on(click):#open on(itemSelected):#onItemSelected',
		'on(blur):#close =tabindex:attribute(tabindex)',
		'resize:#calculateDimensions on(scroll):#calculateDimensions',
		'keypress:prevent:#onKey'
	]
}, {
	selectedLabel: '',
	// Selected options
	selected: null,
	opened: false,
	tabindex: 0,
	minMenuWidth: null,
	maxMenuHeight: null,
	value: null,

	onKey: function(ev)
	{
		if (ev.key==="Enter")
		{
			if (!this.opened)
				this.open();
		} else if (ev.key==='Escape')
			this.close();
	},

	calculateDimensions: function()
	{
		//var rect = this.$component.rect;

		//this.menu.style.minWidth = rect.width + 'px';
		//this.menu.style.maxHeight = (cxl.root.rect.height - rect.bottom) + 'px';
	},

	open: function()
	{
		this.calculateDimensions();
		this.opened = !this.opened;
	},

	close: function()
	{
		this.opened = false;
	},

	onItemSelected: function(ev)
	{
	var
		target = ev.target,
		// TODO
		label = target.childNodes.getText(),
		val = target.get('value'),
		index
	;
		if (val===null)
			val = label;

		// TODO...
		this.value = this.value || [];
		this.selected = this.selected || [];

		index = this.selected.indexOf(target);

		if (index===-1)
		{
			this.selected.push(target);
			this.value.push(val);
		}
		else
		{
			this.selected.splice(index, 1);
			this.value.splice(index, 1);
		}

		target.set('selected', !target.get('selected'));

		this.$component.trigger('change');
		this.close();
	}
});

cxl.component({
	name: 'cxl-dropdown-toggle',
	bindings: [ 'on(click):emit(dropdown.toggle)' ],
	require: 'cxl-dropdown'
});

cxl.component({
	name: 'cxl-dropdown-target',
	bindings: [ '=$parent.opened:show' ]
});

cxl.component({
	name: 'cxl-dropdown',
	attributes: [ 'opened' ]
}, {
	opened: false,
	toggle: function()
	{
		this.opened = !this.opened;
	}
});

cxl.component({
	name: 'cxl-subheader',
	styles: {
		$: { fontSize: 14, lineHeight: 16, color: css.textSubtitle, padding: 16, fontWeight: 'bold' }
	}
});

/**
 * A component that toggles the display of a <cxl-menu>.
 */
cxl.component({
	name: 'cxl-olddropdown',
	template: '<cxl-menu-backdrop &="click:#toggle =opened:if"></cxl-menu-backdrop>' +
		'<cxl-menu &="=opened:if content"></cxl-menu>' +
		'<span &="=label:text"></span>',
	attributes: [ 'label', 'tabindex', 'disabled', 'align', 'placeholder' ],
	bindings: [
		'on(click):stop:#toggle =tabindex:attribute(tabindex)',
		'keypress:prevent:#onKey'
	]
}, {
	tabindex: 0,
	align: 'top',
	opened: false,

	onKey: function(ev)
	{
		switch (ev.key) {
		case 'Enter': case ' ':
			if (!this.opened)
				this.open();
			break;
		case 'Escape':
			this.close();
			break;
		}
	},

	/**
	 * Calculate the menu dimensions based on content and position.
	 */
	calculateDimensions: function()
	{
	var
		rect = this.$component.rect,
		menuRect = this.menu.rect,
		selectedRect = this.selected && this.selected.rect,
		minTop = rect.height,
		maxTop = rect.top-minTop,
		maxHeight,
		marginTop = selectedRect ? selectedRect.offsetTop : 0,
		scrollTop = 0, height
	;
		if (marginTop > maxTop)
		{
			scrollTop = marginTop-maxTop;
			marginTop = maxTop;
		}

		menuRect.minWidth = rect.width;
		menuRect.marginTop = -marginTop;

		height = menuRect.scrollHeight-scrollTop;
		maxHeight = cxl.dom.root.rect.height - rect.bottom + marginTop;

		if (height > maxHeight)
			height = maxHeight;
		else if (height < minTop)
			height = minTop;

		menuRect.height = height;
		menuRect.scrollTop = scrollTop;
	},

	open: function() { this.calculateDimensions(); this.opened = true; },

	close: function() { this.opened = false; }

});

/**
 * An improved <select> box.
 */
cxl.component({
	name: 'cxl-select',
	template:
		'<cxl-menu dense &="id(menu) style(menu) =opened:style(menuOpened)' +
		'content(cxl-option, cxl-optgroup)"></cxl-menu>' +
		'<cxl-icon &="=opened:hide =readonly:hide style(icon)" icon="caret-down"></cxl-icon>',
	attributes: [ 'tabindex', 'disabled', 'selected', 'value', 'readonly' ],
	bindings: [
		'on(itemSelected):stop:#onItemSelected',
		'=value:#onValue =tabindex:attribute(tabindex) =disabled:style(disabled)',
		'keypress:prevent:#onKey',
		'on(click):#open =opened:style(opened) on(blur):#close',
		'=readonly:style(readonly)'
	],
	styles: {
		$: {
			height: 33, cursor: 'pointer', position: 'relative', overflowY: 'hidden',
			border: 0, borderBottom: 1, borderStyle: 'solid', borderColor: css.grayDark
		},
		icon: { position: 'absolute', right: 8, top: 8, lineHeight: 16 },
		menu: { position: 'absolute', elevation: 0, right: 0, left: -16, overflowY: 'hidden' },
		menuOpened: { elevation: 3, overflowY: 'auto' },
		opened: { overflowY: 'visible' },
		readonly: { borderStyle: 'dashed' }
	},

	initialize: function(state)
	{
		state.calculateDimensions = cxl.debounce(state.$calculateDimensions);
	},

	ready: function(state) {
		state.calculateDimensions();
	}

}, {
	selectedLabel: '',
	// Selected options
	selected: null,
	// Current focused option
	active: null,
	placeholder: '',
	opened: false,
	tabindex: 0,
	value: null,

	onKey: function(ev)
	{
		if (this.readonly)
			return;
		
		var component = this.$component;

		switch (ev.key) {
		case 'Enter': case ' ':
			if (!this.opened)
				this.open();
			break;
		case 'Escape':
			this.close();
			break;
		case 'ArrowDown':
			if (!this.opened)
			{
				this.selected = this.selected.next('cxl-option');
			} else
			{
				this.active = this.active ? this.active.next('cxl-option') : component.query('cxl-option');
			}
			break;
		case 'ArrowUp':
			if (!this.opened)
			{
				this.selected = this.selected.next('cxl-option');
			} else
			{
				this.active = this.active ? this.active.next('cxl-option') : component.query('cxl-option');
			}
			break;
		}
	},

	// Debounced function
	calculateDimensions: null,

	/**
	 * Calculate the menu dimensions based on content and position.
	 */
	$calculateDimensions: function()
	{
	var
		rect = this.$component.rect,
		menuRect = this.menu.rect,
		selectedRect = this.selected && this.selected.rect,
		minTop = rect.height,
		maxTop = rect.top-minTop,
		maxHeight,
		marginTop = selectedRect ? selectedRect.offsetTop : 0,
		scrollTop = 0, height,
		menuStyle = this.menu.inlineStyle
	;
		if (marginTop > maxTop)
		{
			scrollTop = marginTop-maxTop;
			marginTop = maxTop;
		}

		menuStyle.marginTop = -marginTop-12;

		height = menuRect.scrollHeight-scrollTop;
		maxHeight = cxl.dom.root.rect.height - rect.bottom + marginTop;

		if (height > maxHeight)
			height = maxHeight;
		else if (height < minTop)
			height = minTop;

		menuStyle.height = height;
		menuRect.scrollTop = scrollTop;
	},

	open: function()
	{
		if (this.readonly)
			return;
		
		this.calculateDimensions();
		this.opened = true;
	},

	close: function()
	{
		this.calculateDimensions();
		this.opened = false;
	},

	onValue: function(val)
	{
		this.selected = this.$component.childNodes.query('CXL-OPTION').find(function(option) {
			return option.get('value')===val;
		});
		this.calculateDimensions();
	},

	onItemSelected: function(ev)
	{
		if (!this.opened)
			return this.open();
	var
		target = ev.target,
		val = target.get('value')
	;
		this.selected = target;

		if (this.value !== val)
		{
			this.value = val;
			this.$component.trigger('change');
		}

		this.close();
	}

});

cxl.directive('cxl.profileLink', function(el) {
	el.href = cxl.$loginURL;
});

Object.assign(cxl.ui, {

	alert: function(options)
	{
		if (typeof(options)==='string')
			options = { message: options };

	var
		modal = cxl.dom('cxl-modal-alert', options)
	;
		modal.set('hidden', false);

		cxl.dom.root.insert(modal);

		return modal.get('promise');
	},

	/**
	 * Confirmation dialog
	 */
	confirm: function(options)
	{
		if (typeof(options)==='string')
			options = { message: options };

		var modal = cxl.dom('cxl-confirm', options);

		cxl.dom.root.insert(modal);

		return modal.$state.promise;
	}

});

})(this.cxl);


(function(cxl) {

var
	//PARAM_NAMES_REGEX = /(?:\(.*?)?[:\*](\w+)\)?/g,
	PARAM_QUERY_REGEX = /([^&=]+)=?([^&]*)/g,
	optionalParam = /\((.*?)\)/g,
	namedParam    = /(\(\?)?:\w+/g,
	splatParam    = /\*\w+/g,
	escapeRegExp  = /[\-{}\[\]+?.,\\\^$|#\s]/g,
	ROUTEID = 0
;

/**
 * Global router. By default it will only support
 * one level/state.
 */
var Router = function() {
	this.routes = {};
	this.routesList = [];
	this.instances = {};
	this.subscribers = [];
	this.subject = new cxl.rx.BehaviorSubject();
};

Router.prototype = {

	started: false,
	currentRoute: null,
	routes: null,
	routesList: null,
	instances: null,

	onHashChange: function(hash)
	{
	var
		route = this.findRouteDefinition(hash),
		args = route && this._extractParameters(route.$meta.regex, hash)
	;
		if (route)
			this.execute(route, args);
	},

	findRouteDefinition: function(hash)
	{
		return this.routesList.find(function(r) {
			return r.$meta.regex && r.$meta.regex.test(hash);
		});
	},

	registerRoute: function(def)
	{
		this.routes[def.$meta.id] = def;
		this.routesList.unshift(def);
	},

	_extractQuery: function(frag, result)
	{
	var
		pos = frag.indexOf('?'),
		query = pos !== -1 ? frag.slice(pos+1) : null,
		m
	;
		while (query && (m = PARAM_QUERY_REGEX.exec(query)))
			result[m[1]] = decodeURIComponent(m[2]);

		return result;
	},

	_extractParameters: function(route, fragment)
	{
	var
		params = route.exec(fragment).slice(1),
		result = {}
	;
		params.forEach(function(param, i) {
			var p;
			// Don't decode the search params.
			p = (i === params.length - 1) ? param || null :
				(param ? decodeURIComponent(param) : null);

			result[route.names[i]] = p;
		});

		return this._extractQuery(fragment, result);
	},

	start: function()
	{
		if (this.started)
			return;

		this.started = true;
		cxl.location.subscribe(this.onHashChange.bind(this));
		this.onHashChange(cxl.location.hash);
	},

	findRoute: function(id, args)
	{
	var
		route = this.instances[id],
		i, params
	;
		if (route)
		{
			params = route && route.get('$parameters');
			for (i in params)
				if (params[i] !== args[i])
					return;
		}

		return route;
	},

	destroyRoute: function(route)
	{
		route.destroy();
	},

	createRoute: function(Route, parent, args)
	{
	var
		route,
		onResolve = function() {
			parent.setContent(route);
			cxl.renderer.digest(parent);

			return route;
		},
		promise
	;
		route = new Route(args);

		if (Route.$meta.title)
			route.$state.title = Route.$meta.title;

		if (Route.$meta.resolve)
			promise = cxl.resolve(Route.$meta.resolve).then(onResolve, this.onError.bind(this));

		return promise || cxl.Promise.resolve(onResolve());
	},

	executeRoute: function(Route, args, instances)
	{
	var
		parentId = Route.$meta.parent,
		Parent = parentId && this.routes[parentId],
		id = Route.$meta.id, me = this, instance
	;
		function onCreateRoute(route)
		{
			return (instances[id] = route);
		}

		function onParentResolved(parent)
		{
			instance = me.findRoute(id, args);

			return instance ? onCreateRoute(instance) :
				me.createRoute(Route, parent || cxl.dom.root, args).then(onCreateRoute);
		}

		return Parent ?
			this.executeRoute(Parent, args, instances).then(onParentResolved) :
			cxl.Promise.resolve(onParentResolved())
		;
	},

	onError: function(e)
	{
		throw e;
	},

	onRoute: function(instances, route)
	{
		this.currentRoute = route;
		this.instances = instances;
		this.subject.next(route);
	},

	execute: function(Route, args)
	{
	var
		instances=this.newInstances={}, oldInstances = this.instances, me = this
	;
		this.executeRoute(Route, args, instances).then(function(route) {
			me.onRoute(instances, route);

			cxl.each(oldInstances, function(oldRoute) {
				if (oldRoute && oldRoute !== me.instances[oldRoute.$meta.id])
					me.destroyRoute(oldRoute);
			});
		});
	},

	getPath: function(routeId)
	{
		var route = this.routes[routeId];

		if (!route)
			throw new Error("cxl.router.getPath - Invalid routeId");

		return route && (route.$meta.path);
	}

};

cxl.router	= new Router();

function routeToRegExp(route)
{
var
	names = [], result
;
	result = new RegExp('^' + route.replace(escapeRegExp, '\\$&')
		.replace(optionalParam, '(?:$1)?')
		.replace(namedParam, function(match, optional) {
			names.push(match.substr(1));
			return optional ? match : '([^/?]+)';
		})
		.replace(splatParam, '([^?]*?)') + '(?:\/|\\?|$)')
	;
	result.names = names;

	return result;
}

cxl.route = function(def, controller)
{
	var route;

	if (typeof(def)==='string')
		def = { path: def };

	def.id = def.id || def.path;

	if (def.path)
	{
		def.regex = routeToRegExp(def.path);

		if (def.regex.names)
			def.attributes = def.attributes ? def.attributes.concat(def.regex.names) :
				def.regex.names;
	}

	// TODO
	if (def.parentBindings)
	{
		if (def.route)
			def.route.parentBindings = def.parentBindings;
		else
			def.route = { parentBindings: def.parentBindings };
	}

	route =	cxl.component(def, controller);

	if (!route.$meta.name)
		route.$meta.name = 'cxl-route' + ROUTEID++;

	cxl.router.registerRoute(route);
};

cxl.dom.registerDecorator('route', function(component, value) {
	if (value && value.parentBindings)
	{
		var parent = cxl.router.newInstances[component.$meta.parent] || cxl.dom.root;

		cxl.parseBinding(component, value.parentBindings, parent);
		// TODO figure out a better way
		cxl.renderer.commitDigest(parent);
	}
});

/**
 * Fires on cxl.route event.
 */
cxl.directive('route', {

	initialize: function()
	{
		this.routeSubscriber = cxl.router.subject.subscribe(this.onRoute.bind(this));
		this.route = this.value;
	},

	onRoute: function(route)
	{
		if (this.parameters)
			route = cxl.router.instances[this.parameters];

		this.route = route;
		cxl.renderer.digest(this.component);
	},

	digest: function()
	{
		return this.route;
	},

	destroy: function()
	{
		this.routeSubscriber.unsubscribe();
	}

});

cxl.directive('route.path', {
	digest: function()
	{
		return cxl.router.getPath(this.parameters);
	}
});

cxl.pipe('route.replace', function(val) {
	var params = this.parameters ? this.component.get(this.parameters) : cxl.router.currentRoute && cxl.router.currentRoute.get('$parameters');
	return params ? cxl.replaceParameters(val, params) : val;
});

cxl.pipe('route.go', function() {
var
	path = cxl.router.getPath(this.parameters),
	params = cxl.router.currentRoute.get('$parameters')
;
	if (params)
		path = cxl.replaceParameters(path, params);

	cxl.location.go('#' + path);
});

cxl.directive('route.link', {

	initialize: function()
	{
		this.routeSubscriber = cxl.router.subject.subscribe(this.digest.bind(this));
	},

	update: function(params)
	{
		var path = '#' + cxl.replaceParameters(cxl.router.getPath(this.parameters), params);

		if (path!==this.value)
			this.element.set('href', path);

		return path;
	},

	digest: function()
	{
		var active = cxl.router.instances[this.parameters];

		this.element.set('active', !!active);
		
		return this.update(this.component.$state);
	},

	destroy: function()
	{
		this.routeSubscriber.unsubscribe();
	}

});

cxl.component({
	name: 'cxl-route-title',
	bindings: [ 'route:#getTitle' ]
}, {
	getTitle: function(route)
	{
		// TODO clean memory?
		if (this.$component.childNodes.length)
			this.$component.childNodes.each(function(node) {
				node.destroy();
			});

		var el = cxl.dom('SPAN');
		cxl.parseBinding(el, 'style(title) =title:text', route);
		cxl.renderer.digest(route);

		this.$component.setContent(el);
	}
});

})(this.cxl);