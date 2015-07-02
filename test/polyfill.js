
//
// Function.bind
//

(function() {

/*jshint freeze:false */

if (!Function.prototype.bind) {
  Function.prototype.bind = function(oThis) {

    var aArgs   = Array.prototype.slice.call(arguments, 1),
        fToBind = this,
        NOP    = function() {},
        Bound  = function() {
          return fToBind.apply(this instanceof NOP ? this : oThis,
                 aArgs.concat(Array.prototype.slice.call(arguments)));
        };

    NOP.prototype = this.prototype;
    Bound.prototype = new NOP();

    return Bound;
  };
}

})();
