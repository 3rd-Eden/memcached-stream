'use strict';

/**
 * Module dependencies.
 */
var Stream = require('stream');

/**
 * Memcached ASCII protocol parser.
 *
 * @constructor
 * @param {Object} options
 */
function Parser(options) {
  // Assigning properties on `this` is faster then adding it to the prototype
  this.readable = true;
  this.writable = true;
}

/**
 * Using __proto__ might not be standard, but it's faster than inheriting
 * normally from a different class.
 */
Parser.__proto__ = Stream.prototype;

Parser.prototype.write = function write() {

};

Parser.prototype.end = function end(buffer) {
  this.writable = false;
};

Parser.prototype.destroy = function destroy() {
  this.writable = false;
};

/**
 * Creates a new Parser stream.
 *
 * @param {Object} options
 * @returns {Parser}
 */
exports.createStream = function createStream(options) {
  return new Parser(options);
};

/**
 * Expose the parser constructor
 *
 * @type {Parser}
 */
exports.Parser = Parser;
