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
  this.destroyed = false;

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
 * @TODO return false when we queued to much
 * @TODO emit `drain` when we drained our queue
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
    this.expected = 0;
    this.parse();
  }

  return true;
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
    , rn      // found a \r\n
    , msg     // stores the response
    , pos     // stores the current position
    , err;    // stores the potential error messages

  for (; i < length; i++) {
    pos = data.charCodeAt(i);
    rn = data.indexOf('\r\n', i);

    // queue more data if we don't have the
    // @TODO re-use the rn variable for slicing and dicing the data
    if (!~rn) {
      this.expecting = (length - i) + 2;
      break;
    }

    //console.log('found starting char:', pos, i, data[i], data.slice(i, 10));

    // @TODO Order this in order of importance
    // @TODO Check if we actually have all data, by checking for the \r\n
    if (pos === 67) {
      // CLIENT_ERROR
      msg = data.slice(i + 13, data.indexOf('\r\n', i + 12));

      err = new Error(msg);
      err.code = 'CLIENT_ERROR';
      this.emit('error', err);

      // message length + command + \r\n
      i += (msg.length + 14);
    } else if (pos === 68) {
      // DELETED
      this.emit('response', 'DELETED');
      i += 8;
    } else if (pos === 69) {
      // END, ERROR, EXISTS
      pos = data.charCodeAt(i + 1);
      if (pos === 78) {
        // END
        this.emit('response', 'END');
        pos = i;
        i += 4;
      } else if (pos === 88) {
        // EXISTS
        this.emit('response', 'EXISTS');
        i += 7;
      } else {
        // ERROR
        err = new Error('Command not known by server');
        err.code = 'ERROR';
        this.emit('error', err);
        i += 6;
      }
    } else if (pos === 78) {
      // NOT_STORED, NOT_FOUND
      pos = data.charCodeAt(i + 4);
      if (pos === 70) {
        // NOT_FOUND
        this.emit('response', 'NOT_FOUND');
        i += 10;
      } else {
        // NOT_STORED
        this.emit('response', 'NOT_STORED');
        i += 11;
      }
    } else if (pos === 79) {
      // OK
      this.emit('response', 'OK');
      i += 3;
    } else if (pos === 83) {
      // SERVER_ERROR, STAT, STORED
      pos = data.charCodeAt(i + 2);
      if (pos === 82) {
        // SERVER_ERROR (12)
        msg = data.slice(i + 13, data.indexOf('\r\n', i + 13));

        err = new Error(msg);
        err.code = 'SERVER_ERROR';
        this.emit('error', err);

        // message length + command + \r\n
        i += (msg.length + 14);
      } else if (pos === 79) {
        // STORED
        this.emit('response', 'STORED');
        i += 7;
      } else {
        // STAT
        // @TODO
      }
    } else if (pos === 84) {
      // TOUCHED
      this.emit('response', 'TOUCHED');
      i += 8;
    } else if (pos === 86) {
      // VALUE, VERSION
      pos = data.charCodeAt(i + 1);
      if (pos === 65) {
        // VALUE
        var start = i
          , value
          , bytes
          , flags
          , key
          , cas;

        // @TODO length folding just like we do in #write
        // @TODO test inline var statement vs outside loop var statement
        // @TODO test if saving the start is a good idea or just

        // key name
        i += 6;
        key = data.slice(i, data.indexOf(' ', i));

        // flags
        i += key.length + 1;
        flags = data.slice(i, data.indexOf(' ', i));

        // bytes
        i += flags.length + 1;
        bytes = +data.slice(i, data.indexOf(' ', i));

        // Now that we know how much bytes we should expect to have all the
        // content or if we need to wait and buffer moar
        if (bytes >= length - i) {
          i = start; // reset to start to start so the buffer gets cleaned up
          this.expecting = bytes;
          break;
        }

        // @TODO determin if we have an optional cas
        i = data.indexOf('\r\n', i) + 2;

        // because we are working with binary data here, we need to alocate
        // a new buffer, so we can properly slice the data from the string as
        // javacript doesn't support String#slice that is binary/multibyte aware
        // @TODO benchmark this against a pure buffer solution
        value = new Buffer(bytes);
        data = data.slice(i);
        i = 0;
        value.write(data, 0, bytes);
        value = value.toString();

        //console.log('bytes:', bytes, 'flags:', flags, 'key:', key);
        this.emit('response', 'VALUE', value, flags, cas, key);

        // + value length & closing \r\n
        i += value.length + 1;
      } else {
        // VERSION
        msg = data.slice(i + 8, data.indexOf('\r\n', i + 8));
        this.emit('response', 'VERSION', msg);

        // message length + command + \r\n
        pos = i;
        i += (msg.length + 9);
      }
    } else if (pos >= 48 && pos <= 57) {
      // numberic response, INC/DEC/ STAT value
      msg = data.slice(i, data.indexOf('\r\n', i));

      if (+msg) {
        this.emit('response', 'INCR/DECR', msg);
        i += (msg.length + 1);
      } else {
        // @TODO handle size response
      }
    } else {
      // UNKOWN RESPONSE
      err = new Error('Unknown response');
      err.data = data.slice(i);
      this.emit('error', err);
    }
  }

  // Removed a chunk of parsed data.
  this.queue = data.slice(i);
  //console.log('CLEANED QUEUEU: ', this.queue.slice(0, 10), this.queue.length);
};

/**
 * End the stream.
 *
 * @param {String} data
 * @api private
 */
Parser.prototype.end = function end(data) {
  if (data) {
    this.queue += data;
    this.parse();
  } else {
    this.destroy();
  }

  this.writable = false;

  // the Parser#destroy emits a `close` event in the nextTick, so we can
  // safely call that before we emit `close` so end event comes before close as
  // required (and done by other Node.js streams)
  this.emit('end');
};

/**
 * Completely murder the stream and clean up all references.
 *
 * @param {Error} exception
 * @api private
 */
Parser.prototype.destroy = Parser.prototype.destroySoon = function destroy(exception) {
  if (this.destroyed) return;

  this.queue = '';
  this.destroyed = true;

  var self = this;
  process.nextTick(function closing () {
    if (exception) self.emit('error', exception);

    self.emit('close', !!exception);
  });
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
