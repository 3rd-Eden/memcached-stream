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

  // Stream interface related properties
  this.readable = true;
  this.writable = true;

  // Parser related properties
  this.queue = '';    // This is where the server responses are parsed from
  this.expecting = 0; // How much bytes we expect to receive before parse a result
}

/**
 * Using __proto__ might not be standard, but it's faster than inheriting
 * normally from a different class.
 */
Parser.__proto__ = Stream.prototype;

Parser.responses = Object.create(null);
[
    'CLIENT_ERROR'  // CLIENT_ERROR <error> \r\n    -- protocol failed
  , 'DELETED'       // DELETED\r\n                  -- value deleted
  , 'END'           // END\r\n                      -- done
  , 'ERROR'         // ERROR\r\n                    -- command not known
  , 'EXISTS'        // EXISTS\r\n                   -- item has been modified
  , 'NOT_FOUND'     // NOT_FOUND\r\n                -- ok, but item not found
  , 'NOT_STORED'    // NOT_STORED\r\n               -- ok, but not stored
  , 'OK'            // OK\r\n                       -- ok
  , 'SERVER_ERROR'  // SERVER_ERROR <error> \r\n    -- server fuckup
  , 'STAT'          // STAT <name> <value>\r\n      -- server stats
  , 'STORED'        // STORED\r\n                   -- saved response
  , 'TOUCHED'       // TOUCHED\r\n                  -- that tickles
  , 'VALUE'         // VALUE <key> <flags> <bytes> [<cas unique>]\r\n -- ok
  , 'VERSION'       // VERSION <version>\r\n        -- server version
  // <number> <count>\r\n                           -- size stat response
  // <number>\r\n                                   -- incr response
  // igoring SLAB reassignment, doesn't seem to be finished

].forEach(function commanding(command, i) {
  Parser.responses[command] = i;
});

/**
 * Receives data from a Stream, we assume that the stream has
 * `setEncoding('utf8')` so we are sure that we receive strings as arguments and
 * don't have to worry about receiving a half UTF-8 characture.
 *
 * @TODO implement backoff for when the queue is to full of data
 *
 * @param {String} data
 * @returns {Boolean} successful write
 */
Parser.prototype.write = function write(data) {
  var length = (this.queue += data).length
    , expected = this.expected;

  // Only parse the data when actually have enough data to parse the complete
  // response, this saves a couple parse calls for large values that stream in
  // their values
  if (!(length < expected || Buffer.byteLength(this.queue) < length)) {
    this.parse();
  }

  return true;
};

Parser.prototype.parse = function parse() {
  var command = this.queue
    , char = command.charCodeAt(0);

  // @TODO Order this in order of importance
  if (char === 67) {
    // CLIENT_ERROR
  } else if (char === 68) {
    // DELETED
  } else if (char === 69) {
    // END,ERROR,EXISTS
    var second = command.charCodeAt(1);
    if (second === 78) {
      // END
    } else if (second === 88) {
      // EXISTS
    } else {
      // ERROR
    }
  } else if (char === 78) {
    // NOT_STORED, NOT_FOUND
    var second = command.charCodeAt(4);
    if (second === 70) {
      // NOT_FOUND
    } else {
      // NOT_STORED
    }
  } else if (char === 79) {
    // OK
  } else if (char === 83) {
    // SERVER_ERROR, STAT, STORED
    var second = command.charCodeAt(2);
    if (second === 82) {
      // SERVER_ERROR
    } else if (second === 79) {
      // STORED
    } else {
      // STAT
    }
  } else if (char === 84) {
    // TOUCHED
  } else if (char === 86) {
    // VALUE, VERSION
    var second = command.charCodeAt(1);
    if (second === 65) {
      // VALUE
    } else {
      // VERSION
    }
  } else if (char >= 48 && char <= 57) {
    // numberic response, INC/DEC/ STAT value
  } else {
    // UNKOWN RESPONSE
  }
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
