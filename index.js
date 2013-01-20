'use strict';

/**
 * Module dependencies.
 */
var Stream = require('stream');

/**
 * Memcached ASCII protocol parser. Based on the protocol that is outlined at:
 *
 * https://github.com/memcached/memcached/blob/master/doc/protocol.txt
 *
 * It follows the complete protocol specification except for the slab
 * reassignment as that was still referred to as work in progress.
 *
 * Options:
 * - {Boolean} readable, is this stream readable. Defaults to true.
 * - {Boolean} writable, is this stream writable. Defaults to true.
 *
 * @constructor
 * @param {Object} options
 * @api public
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

/**
 * Simple lookup table for the different response types.
 *
 * @type {Object}
 * @api private
 */
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
 * @api public
 */
Parser.prototype.write = function write(data) {
  var length = (this.queue += data).length
    , expected = this.expected;

  // Only parse the data when actually have enough data to parse the complete
  // response, this saves a couple parse calls for large values that stream in
  // their values.
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
    , bytesRemaining = Buffer.byteLength(data)
    , charCode          // Stores the current cursor position
    , rn                // Found a \r\n
    , msg               // Stores the response
    , err               // Stores the potential error message
    , length;           // Stores the total message length which is added to the
                        // cursor and substracted from the bytesRemaining

  for (var i = 0, l = data.length; i < l; i++) {
    charCode = data.charCodeAt(i);
    rn = data.indexOf('\r\n', i);

    // The only certainy we have from the protocol is that every message ends
    // with a \r\n. If don't have this char in our data set anymore it means
    // that we need to queue more information before we sucessfully parse the
    // response.
    if (!~rn) {
      this.expecting = bytesRemaining + 2;
      break;
    }

    // @TODO Order this in order of importance
    if (charCode === 67) {
      // CLIENT_ERROR (charCode 67 === C):
      //
      // Parse the error messages that are caused by the client by sending
      // invalid messages to the server.
      msg = data.slice(i + 13, rn);

      err = new Error(msg);
      err.code = 'CLIENT_ERROR';
      this.emit('error', err);

      // command length + message length + separators
      length = msg.length + 14;
      bytesRemaining -= length;
      i += length;
    } else if (charCode === 68) {
      // DELETED (charCode 68 === D):
      //
      // The they was successfully removed from the server.
      this.emit('response', 'DELETED');

      i += 8;
      bytesRemaining -= 8;
    } else if (charCode === 69) {
      // END, ERROR, EXISTS (charCode 69 === E):
      //
      // We need to scan deeper to figure out which command we are dealing with.
      // The second char is different in every command, so test against that.
      charCode = data.charCodeAt(i + 1);

      if (charCode === 78) {
        // END:
        //
        // The END command indicates that all data has been send and that the
        // response for the command has ended. This is used for multipe STAT or
        // VALUE responses etc.
        this.emit('response', 'END');

        i += 4;
        bytesRemaining -= 4;
      } else if (charCode === 88) {
        // EXISTS:
        //
        // The item that you tried to store already exists on server and it's
        // CAS value is expired.
        this.emit('response', 'EXISTS');

        i += 7;
        bytesRemaining -= 7;
      } else {
        // ERROR:
        //
        // The command that was send by the client is not known by the server.
        err = new Error('Command not known by server');
        err.code = 'ERROR';
        this.emit('error', err);

        i += 6;
        bytesRemaining -= 6;
      }
    } else if (charCode === 78) {
      // NOT_STORED, NOT_FOUND (charCode 78 === N):
      //
      // We need to scan deeper to fully determin the actual command. As the
      // first part of by responses start with NOT_ we need to check the 4th
      // char to determin which command we are dealing with.
      charCode = data.charCodeAt(i + 4);

      if (charCode === 70) {
        // NOT_FOUND:
        //
        // The item that the client is trying to store while using a CAS value
        // does not exist.
        this.emit('response', 'NOT_FOUND');

        i += 10;
        bytesRemaining -= 10;
      } else {
        // NOT_STORED:
        //
        // The data was not stored, this is not due to a failure but it failed
        // to pass the condition of a ADD or REPLACE command.
        this.emit('response', 'NOT_STORED');

        i += 11;
        bytesRemaining -= 11;
      }
    } else if (charCode === 79) {
      // OK (charCode 79 === O):
      //
      // OKIDOKIE, we are going to do the thing you asked the server todo.
      this.emit('response', 'OK');

      i += 3;
      bytesRemaining -= 3;
    } else if (charCode === 83) {
      // SERVER_ERROR, STAT, STORED (charCode 83 === S):
      //
      // We need to scan deeper, as the are multiple commands starting with an
      // S we need to check the second char to determin the correct command.
      charCode = data.charCodeAt(i + 2);

      if (charCode === 82) {
        // SERVER_ERROR:
        //
        // We are fucked, the server is fucked, everything is fucked.
        msg = data.slice(i + 13, rn);

        err = new Error(msg);
        err.code = 'SERVER_ERROR';
        this.emit('error', err);

        // command length + message length + separators
        length = msg.length + 14;
        i += length;
        bytesRemaining -= length;
      } else if (charCode === 79) {
        // STORED:
        //
        // The data was stored successfully.
        this.emit('response', 'STORED');

        i += 7;
        bytesRemaining -= 7;
      } else {
        // STAT:
        //
        // Received a stat from the server.
        // @TODO
      }
    } else if (charCode === 84) {
      // TOUCHED (charCode 84 === T):
      //
      // Updated the expiree of the given key.
      this.emit('response', 'TOUCHED');

      i += 8;
      bytesRemaining -= 8;
    } else if (charCode === 86) {
      // VALUE, VERSION
      charCode = data.charCodeAt(i + 1);

      if (charCode === 65) {
        // VALUE
        var start = i // Store our starting point, so we can reset the cursor
          , hascas    // Do we have a CAS response
          , value     // Stored the value buffer
          , bytes     // The amount of bytes
          , flags     // The flags that were stored with the value
          , key       // Stores key
          , cas;      // Stores the CAS value

        // @TODO length folding just like we do in #write
        // @TODO test inline var statement vs outside loop var statement
        // @TODO test if saving the start is a good idea or just

        i += 6;

        // key name
        key = data.slice(i, data.indexOf(' ', i));
        i += key.length + 1;
        bytesRemaining -= Buffer.byteLength(key) + 1; // Key can be unicode

        // flags
        flags = data.slice(i, data.indexOf(' ', i));
        length = flags.length + 1;
        i += length;
        bytesRemaining -= length;

        // check if we have a space in this batch so we know if there's a CAS
        // value and that the bytes should be split on the space or on a \r\n
        charCode = data.indexOf(' ', i);
        hascas = ~charCode && charCode < rn;

        bytes = data.slice(i
          , hascas
            ? charCode
            : rn
        );

        length = bytes.length + 1;
        i += length;
        bytesRemaining -= length;

        // Now that we know how much bytes we should expect to have all the
        // content or if we need to wait and buffer moar
        bytes = +bytes;
        if (bytes >= bytesRemaining) {
          i = start; // reset to start to start so the buffer gets cleaned up
          this.expecting = bytes;
          break;
        }

        if (hascas) {
          cas = data.slice(i, rn);

          length = cas.length + 2;
          i += length;
          bytes -= length;
        } else {
          i += 1;
          bytesRemaining -= 1;
        }

        // Because we are working with binary data here, we need to alocate
        // a new buffer, so we can properly slice the data from the string as
        // javacript doesn't support String#slice that is binary/multibyte aware
        // @TODO benchmark this against a pure buffer solution.
        value = new Buffer(bytes);

        // @TODO test if it really matters if we slice off the data first so we
        // have smaller string to write to the buffer.
        // data = data.slice(i);
        // i = 0;

        value.write(data, 0, bytes);
        value = value.toString();

        this.emit('response', 'VALUE', value, flags, cas, key);

        // + value length & closing \r\n
        i += value.length + 1;
        bytesRemaining -= bytes + 1;
      } else {
        // VERSION:
        //
        // The server version, usually semver formatted but it can also contain
        // alpha chars such as beta, dev or pewpew
        msg = data.slice(i + 8, rn);
        this.emit('response', 'VERSION', msg);

        // message length + command + \r\n
        length = msg.length + 9;
        i += length;
        bytesRemaining -= length;
      }
    } else if (charCode >= 48 && charCode <= 57) {
      // INCR/DECR/STAT (charCode 48 === '0' && charCode 57 === 9)
      //
      // It checks if we have a numeric response, this is only returned for INC,
      // DECR or item size response.
      msg = data.slice(i, rn);

      if (+msg) {
        this.emit('response', 'INCR/DECR', msg);

        length = msg.length + 1;
        i += length;
        bytesRemaining -= length;
      } else {
        // @TODO handle size response
      }
    } else {
      // UNKOWN RESPONSE, something went really fucked up wrong, we should
      // probably destroy the parser.
      err = new Error('Unknown response');
      err.data = data.slice(i);
      this.emit('error', err);
    }
  }

  // Removed a chunk of parsed data.
  this.queue = data.slice(i);
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
 * Expose the parser constructor.
 *
 * @type {Parser}
 */
exports.Parser = Parser;
