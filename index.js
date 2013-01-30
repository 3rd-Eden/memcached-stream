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
  // Assigning properties on `this` is faster then adding it to the prototype.

  // Stream interface related properties.
  this.readable = 'readable' in options ? options.readable : true;
  this.writable = 'writable' in options ? options.writable : true;
  this.destroyed = false;

  // Parser related properties.
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
 * - (*g) These responses are available for garantiadata.com cloud only
 *   http://garantiadata.com/blog/finally-you-can-see-whats-stored-in-your-memcached
 *
 * @type {Object}
 * @api private
 */
Parser.responses = Object.create(null);
[
    'CLIENT_ERROR'  // CLIENT_ERROR <error> \r\n    -- Protocol failed
  , 'DELETED'       // DELETED\r\n                  -- Value deleted
  , 'END'           // END\r\n                      -- Done
  , 'KEY'           // KEY <bytes> <key>            -- Key response (*g)
  , 'ERROR'         // ERROR\r\n                    -- Command not known
  , 'EXISTS'        // EXISTS\r\n                   -- Item has been modified
  , 'NOT_FOUND'     // NOT_FOUND\r\n                -- OK, but item not found
  , 'NOT_STORED'    // NOT_STORED\r\n               -- OK, but not stored
  , 'OK'            // OK\r\n                       -- OK
  , 'SERVER_ERROR'  // SERVER_ERROR <error> \r\n    -- Server fuckup
  , 'STAT'          // STAT <name> <value>\r\n      -- Server stats
  , 'STORED'        // STORED\r\n                   -- Saved response
  , 'TOUCHED'       // TOUCHED\r\n                  -- That tickles
  , 'VALUE'         // VALUE <key> <flags> <bytes> [<cas unique>]\r\n -- ok
  , 'VERSION'       // VERSION <version>\r\n        -- Server version
  , 'INCR/DECR'     // <number>\r\n                 -- Incr response
  , '+OK'           // +OK\r\n                      -- In monitor mode (*g)
  // <number> <count>\r\n                           -- Size stat response

  // <unix.unix> <command> <key> <flags> <expire> [bytes] [value]
  // - This is the format for the monitor response, bytes and value are only set
  //   when a storage command is issued

  // Ignoring SLAB reassignment, doesn't seem to be finished.
].forEach(function commanding(command, i) {
  Parser.responses[i] = command;
});

/**
 * Receives data from a Stream, we assume that the stream has
 * `setEncoding('utf8')` so we are sure that we receive strings as arguments and
 * don't have to worry about receiving a half UTF-8 character.
 *
 * @TODO implement back off for when the queue is to full of data
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
                        // cursor and subtracted from the bytesRemaining

  for (var i = 0, l = data.length; i < l; i++) {
    charCode = data.charCodeAt(i);
    rn = data.indexOf('\r\n', i);

    // The only certainty we have from the protocol is that every message ends
    // with a \r\n. If don't have this char in our data set anymore it means
    // that we need to queue more information before we successfully parse the
    // response.
    if (!~rn) {
      this.expecting = bytesRemaining + 2;
      break;
    }

    // @TODO Order this in order of importance
    // @TODO see if we can reduce the amount i += calls by setting rn value..
    if (charCode === 67) {
      // CLIENT_ERROR (charCode 67 === C):
      //
      // Parse the error messages that are caused by the client by sending
      // invalid messages to the server.
      msg = data.slice(i + 13, rn);

      err = new Error(msg);
      err.code = 'CLIENT_ERROR';
      this.emit('error:response', err);

      // command length + message length + separators
      length = msg.length + 14;
      i += length;
      bytesRemaining -= length;
    } else if (charCode === 68) {
      // DELETED (charCode 68 === D):
      //
      // The they was successfully removed from the server.
      this.emit('response', 'DELETED', true);

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
        // response for the command has ended. This is used for multiple STAT or
        // VALUE responses etc.
        this.emit('response', 'END', true);

        i += 4;
        bytesRemaining -= 4;
      } else if (charCode === 88) {
        // EXISTS:
        //
        // The item that you tried to store already exists on server and it's
        // CAS value is expired.
        this.emit('response', 'EXISTS', false);

        i += 7;
        bytesRemaining -= 7;
      } else {
        // ERROR:
        //
        // The command that was send by the client is not known by the server.
        err = new Error('Command not known by server');
        err.code = 'ERROR';
        this.emit('error:response', err);

        i += 6;
        bytesRemaining -= 6;
      }
    } else if (charCode === 78) {
      // NOT_STORED, NOT_FOUND (charCode 78 === N):
      //
      // We need to scan deeper to fully determine the actual command. As the
      // first part of by responses start with NOT_ we need to check the 4th
      // char to determine which command we are dealing with.
      charCode = data.charCodeAt(i + 4);

      if (charCode === 70) {
        // NOT_FOUND:
        //
        // The item that the client is trying to store while using a CAS value
        // does not exist.
        this.emit('response', 'NOT_FOUND', false);

        i += 10;
        bytesRemaining -= 10;
      } else {
        // NOT_STORED:
        //
        // The data was not stored, this is not due to a failure but it failed
        // to pass the condition of a ADD or REPLACE command.
        this.emit('response', 'NOT_STORED', false);

        i += 11;
        bytesRemaining -= 11;
      }
    } else if (charCode === 79) {
      // OK (charCode 79 === O):
      //
      // OKIDOKIE, we are going to do the thing you asked the server todo.
      this.emit('response', 'OK', true);

      i += 3;
      bytesRemaining -= 3;
    } else if (charCode === 83) {
      // SERVER_ERROR, STAT, STORED (charCode 83 === S):
      //
      // We need to scan deeper, as the are multiple commands starting with an
      // S we need to check the second char to determine the correct command.
      charCode = data.charCodeAt(i + 2);

      if (charCode === 82) {
        // SERVER_ERROR:
        //
        // We are fucked, the server is fucked, everything is fucked.
        msg = data.slice(i + 13, rn);

        err = new Error(msg);
        err.code = 'SERVER_ERROR';
        this.emit('error:response', err);

        // command length + message length + separators
        length = msg.length + 14;
        i += length;
        bytesRemaining -= length;
      } else if (charCode === 79) {
        // STORED:
        //
        // The data was stored successfully.
        this.emit('response', 'STORED', true);

        i += 7;
        bytesRemaining -= 7;
      } else {
        // STAT:
        //
        // Received a stat from the server.
        var pos = data.indexOf(' ', i + 5)
          , val;

        msg = data.slice(i + 5, pos);
        val = data.slice(pos + 1, rn);

        this.emit('response', 'STAT', msg, val);

        length = msg.length + val.length + 7;
        i += length;
        bytesRemaining -= length;
      }
    } else if (charCode === 84) {
      // TOUCHED (charCode 84 === T):
      //
      // Updated the expiry of the given key.
      this.emit('response', 'TOUCHED', true);

      i += 8;
      bytesRemaining -= 8;
    } else if (charCode === 86) {
      // VALUE, VERSION (charCode 86 === V):
      //
      // Either a value or a version response, moving the cursor by one char
      // yields enough specificity to determine the correct response.
      charCode = data.charCodeAt(i + 1);

      if (charCode === 65) {
        // VALUE:
        //
        // This is where all the magic happens, value parsing is one if not THE
        // hardest part of parsing the server responses, we have key that could
        // be Unicode an optional CAS value and a response who's length is
        // specified in bytes. These bytes is something that isn't easily
        // supported within JavaScript. When you do a `.length` on a string you
        // get the char count and not the actual bytes. Pure Buffer parsing
        // might be an option for some people, but it's a lot of switching
        // between C++ calls vs regular optimized JavaScript shizzle.
        var start = i // Store our starting point, so we can reset the cursor
          , hascas    // Do we have a CAS response
          , value     // Stored the value buffer
          , bytes     // The amount of bytes
          , flags     // The flags that were stored with the value
          , key       // Stores key
          , cas;      // Stores the CAS value

        // @TODO length folding just like we do in #write
        // @TODO test inline var statement vs outside loop var statement
        // @TODO test if saving the start is a good idea or just pointless
        i += 6;
        bytesRemaining += 6;

        // Key name
        key = data.slice(i, data.indexOf(' ', i));
        i += key.length + 1;
        bytesRemaining -= Buffer.byteLength(key) + 1; // Key can be Unicode

        // Flags
        flags = data.slice(i, data.indexOf(' ', i));
        length = flags.length + 1;
        i += length;
        bytesRemaining -= length;

        // Check if we have a space in this batch so we know if there's a CAS
        // value and that the bytes should be split on the space or on a \r\n.
        charCode = data.indexOf(' ', i);
        hascas = ~charCode && charCode < rn;

        // Bytes
        bytes = data.slice(i
          , hascas
            ? charCode
            : rn
        );

        length = bytes.length + 1;
        i += length;
        bytesRemaining -= length;

        // Now that we know how much bytes we should expect to have all the
        // content or if we need to wait and buffer more.
        bytes = +bytes;
        if (bytes >= bytesRemaining) {
          // Reset the cursor to the start of the command so the parsed data is
          // removed from the queue when we leave the loop.
          i = start;
          this.expecting = bytes;
          break;
        }

        // The CAS value is optionally.
        if (hascas) {
          cas = data.slice(i, rn);

          length = cas.length + 2;
          i += length;
          bytesRemaining -= length;
        } else {
          i += 1;
          bytesRemaining -= 1;
        }

        // Because we are working with binary data here, we need to allocate
        // a new buffer, so we can properly slice the data from the string as
        // JavaScript doesn't support String#slice that is binary/multi byte aware
        // @TODO benchmark this against a pure buffer solution.
        value = new Buffer(bytes);
        value.write(data.slice(i), 0, bytes);

        // @TODO we might not want to override the Buffer with a string version
        // as the flag can indicate that it's a Buffer instance. Also these
        // decisions should be made by the client, not the parser.
        // @TODO we might not even need to change it to a string, as we are only
        // doing this atm so we can add the value's length to the cursor (i).
        value = value.toString();

        this.emit('response', 'VALUE', value, flags, cas, key);

        // + value length & closing \r\n
        i += value.length + 1;
        bytesRemaining -= bytes + 1;
      } else {
        // VERSION:
        //
        // The server version, usually semver formatted but it can also contain
        // alpha chars such as beta, dev or pewpew.
        msg = data.slice(i + 8, rn);
        this.emit('response', 'VERSION', msg);

        // message length + command + \r\n
        length = msg.length + 9;
        i += length;
        bytesRemaining -= length;
      }
    } else if (charCode >= 48 && charCode <= 57) {
      // INCR/DECR/STAT (charCode 48 === '0' && charCode 57 === 9):
      //
      // It checks if we have a numeric response, this is only returned for INC,
      // DECR or item size response.
      msg = data.slice(i, rn);

      if (+msg) {
        this.emit('response', 'INCR/DECR', +msg);

        length = msg.length + 1;
        i += length;
        bytesRemaining -= length;
      } else {
        // @TODO handle size response
      }
    } else if (charCode === 75) {
      // KEY (charCode 75 === 'KEY'):
      //
      // KEY <bytes> key response, so we know which keys are set in memcached
      // while the response sets bytes, we can just scan for the ending \r\n and
      // get the key name.
      var pos = data.indexOf(' ', i + 4)
        , val;

      val = data.slice(i + 4, pos);
      msg = data.slice(pos + 1, rn);

      this.emit('response', 'KEY', msg);

      i += val.length + msg.length + 6;
      bytesRemaining -= +val + val.length + 6;
    } else {
      // UNKNOWN RESPONSE, something went really fucked up wrong, we should
      // probably destroy the parser.
      err = new Error('Unknown response');
      err.CODE = 'EPARSERFUCKUPLULZ';
      err.data = data.slice(i);

      // DIE
      this.destroy(err);
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

  // The Parser#destroy emits a `close` event in the nextTick, so we can
  // safely call that before we emit `close` so end event comes before close as
  // required (and done by other Node.js streams).
  this.emit('end');
};

/**
 * Completely murder the stream and clean up all references.
 *
 * @param {Error} err
 * @api private
 */
Parser.prototype.destroy = Parser.prototype.destroySoon = function destroy(err) {
  if (this.destroyed) return;

  this.queue = '';
  this.destroyed = true;
  this.writable = false;

  var self = this;
  process.nextTick(function closing () {
    if (err) self.emit('error', err);

    self.emit('close', !!err);
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
