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
  options = options || {};
  // Assigning properties on `this` is faster then adding it to the prototype

  // Stream interface related properties
  this.readable = 'readable' in options ? options.readable : true;
  this.writable = 'writable' in options ? options.writable : true;

  // Parser related properties
  this.queue = '';    // This is where the server responses are parsed from
  this.expecting = 0; // How much bytes we expect to receive before parse a result
}

/**
 * Using __proto__ might not be standard, but it's faster than inheriting
 * normally from a different class.
 */
Parser.prototype.__proto__ = Stream.prototype;

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

  return this.writable;
};

/**
 * Parse the memcached protocol.
 *
 * @api private
 */
Parser.prototype.parse = function parse() {
  var data = this.queue
    , length = data.length
    , i = 0
    , msg
    , pos;

  for (; i < length; i++) {
    pos = data.charCodeAt(i);

    // @TODO Order this in order of importance
    // @TODO Check if we actually have all data, by checking for the \r\n
    if (pos === 67) {
      // CLIENT_ERROR
      msg = data.slice(i + 13, data.indexOf('\r\n', i + 12));
      this.emit('error', new Error(msg));

      // message length + command + \r\n
      i += (msg.length + 15);
    } else if (pos === 68) {
      // DELETED
      this.emit('response', 'DELETED');
      i += 9;
    } else if (pos === 69) {
      // END, ERROR, EXISTS
      pos = data.charCodeAt(i + 1);
      if (pos === 78) {
        // END
        this.emit('response', 'END');
        i += 5;
      } else if (pos === 88) {
        // EXISTS
        this.emit('response', 'EXISTS');
        i += 8;
      } else {
        // ERROR
        this.emit('error', new Error('Command not known by server'));
        i += 7;
      }
    } else if (pos === 78) {
      // NOT_STORED, NOT_FOUND
      pos = data.charCodeAt(i + 4);
      if (pos === 70) {
        // NOT_FOUND
        this.emit('response', 'NOT_FOUND');
        i += 11;
      } else {
        // NOT_STORED
        this.emit('response', 'NOT_STORED');
        i += 12;
      }
    } else if (pos === 79) {
      // OK
      this.emit('response', 'OK');
      i += 4;
    } else if (pos === 83) {
      // SERVER_ERROR, STAT, STORED
      pos = data.charCodeAt(i + 2);
      if (pos === 82) {
        // SERVER_ERROR (12)
        msg = data.slice(i + 13, data.indexOf('\r\n', i + 13));
        this.emit('error', new Error(msg));

        // message length + command + \r\n
        i += (msg.length + 15);
      } else if (pos === 79) {
        // STORED
        this.emit('response', 'STORED');
        i += 8;
      } else {
        // STAT
      }
    } else if (pos === 84) {
      // TOUCHED
      this.emit('response', 'TOUCHED');
      i += 9;
    } else if (pos === 86) {
      // VALUE, VERSION
      pos = data.charCodeAt(i + 1);
      if (pos === 65) {
        // VALUE
      } else {
        // VERSION
        msg = data.slice(i + 8, data.indexOf('\r\n', i + 8));
        this.emit('response', 'VERSION', msg);

        // message length + command + \r\n
        i += (msg.length + 10);
      }
    } else if (pos >= 48 && pos <= 57) {
      // numberic response, INC/DEC/ STAT value
      msg = data.slice(i, data.indexOf('\r\n', i));

      if (+msg) {
        this.response('response', 'INCR/DECR', msg);
        i += (msg.length + 2);
      } else {
        // @TODO handle size response
      }
    } else {
      // UNKOWN RESPONSE
      this.emit('error', new Error('Unknown response'));
    }
  }

  // Removed a chunk of parsed data.
  this.queue = data.slice(i);
};

Parser.prototype.end = function end(data) {
  if (data) {
    this.queue += data;
    this.parse();
  }

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
