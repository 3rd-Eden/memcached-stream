'use strict';

var portnumber = 1024;

/**
 * Automatic increasing test numbers.
 *
 * Example:
 *   var port = portnumbers
 *     , another = portnumbers;
 *
 *   console.log(port, portnumber); // 1025, 1026
 *
 * @api public
 */
Object.defineProperty(global, 'portnumbers', {
  get: function get() {
    return portnumber++;
  }
});
