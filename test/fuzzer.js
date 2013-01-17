'use strict';

var Server = require('net').Server
  , g = require('garbage')
  , fs = require('fs');

/**
 * Memcached server response fuzzer.
 *
 * @constructor
 * @param {Object} options
 * @api private
 */
function Fuzzer(options) {
  options = options || {};
  var self = this;

  //
  // Setup our configuration object, this layout also makes it accept nconf
  // instances which is useful for testing.
  //
  this.config = Object.create(null);
  this.config.set = this.config.set || function set(key, value) {
    self.config[key] = value;
  };
  this.config.get = this.config.get || function get(key) {
    return self.config[key];
  };

  //
  // Set the known default values of a memcached server, but can differ between
  // different implementations.
  //
  this.config.set('max key size', 250);         // 250 - 300 chars by default
  this.config.set('max expiration', 2592000);   // 30 days, or that nr in seconds
  this.config.set('max value size', 1048576);   // 1MB aka xxx bytes

  //
  // Fuzzer configuration.
  //
  this.config.set('interval', 10);              // each <x> ms send a new response
  this.config.set('responses', 1000);           // the amount of responses to send
  this.config.set('unique values', 25);         // unique VALUE responses (stored in mem)
  this.config.set('auto close', true);          // automatically close the connection
  this.config.set('write log', true);           // should we write a log send data
  this.config.set('log location', __dirname);   // where to write the log
  this.config.set('replies'
    , Object.keys(Fuzzer.responders)            // responses we want to receive
  );

  // Set the received options.
  Object.keys(options).forEach(function update(key) {
    this.config.set(key, options[key]);
  }, this);

  //
  // Start listening for connections so we can write out responses.
  //
  this.on('connection', this.connector.bind(this));

  //
  // Generate the different response that our API can give. As some responses
  // need to happen more frequently the API's have a custom weight property that
  // indications how many times we should add it our responses set to create
  // a greater propability that this reply is send to the server.
  //
  this.responses = this.config.get('replies').reduce(function reduce(memo, key) {
    var weight = Fuzzer.responders[key].weight || 1;

    while (weight--) memo.push(key);
    return memo;
  }, []);
}

/**
 * The Fuzzer inherits from the net.Server, which is also an EventEmitter.
 */
Fuzzer.prototype.__proto__ = Server.prototype;

/**
 * A new connection has been made to the fuzzer.
 *
 * @param {net.Socket} socket
 * @api private
 */
Fuzzer.prototype.connector = function connector(socket) {
  var responses = this.config.get('responses')
    , interval = this.config.get('interval')
    , iterations = 0
    , self = this
    , start;

  console.log(
      'received a new connection, sending %d responses'
    , this.config.get('responses')
  );

    if (++iterations >= this.config.get('responses')) {
      if (this.config.get('auto close')) {
      }

      return clearInterval(interval);
    }

  start = Date.now();
  (function loophole () {
    self.random(socket, function callback(err) {
      if (err) return socket.end();

      process.stdout.write('writing response: '+ iterations +'\r');
      if (++iterations >= responses) {
        if (self.config.get('auto close')) {
          console.log();
          socket.end();
          console.log('auto closed the connection');
        }

        return;
      }

      var duration = Date.now() - start;
      if (duration < interval) return setTimeout(loophole, interval - duration);

      loophole();
    });
  })();

  // Make sure we clear the interval once
  socket.once('end', function theend() {
    iterations = this.config.get('responses');
  }.bind(this));
};

/**
 * Write a fuzzy line to the given socket connection.
 *
 * @param {net.Server} socket
 * @param {Function} callback
 * @api private
 */
Fuzzer.prototype.random = function random(socket, callback) {
  var reply = this.responses[ Math.floor(Math.random() * this.responses.length) ]
    , self = this;

  Fuzzer.responders[reply](this.config, function (err, line) {
    // Handle errors as if they were server errors
    if (err) {
      line = 'SERVER_ERROR '+ err.message +'\r\n';
      reply = 'SERVER_ERROR';
    }

    // Emit that we are writing a new response to the connection, this is useful
    // if you wish to integrate the tool in to your test suite and confirm that
    // every line it receives is parsed correctly.
    self.emit('fuzzer', reply, line);
    socket.write(line, callback);
  });
};

/**
 * The different response generators. Please note that we are using the actual
 * error responses that a REGULAR memcached server would send. These values have
 * been extracted from the source.
 *
 * https://github.com/memcached/memcached:
 * - 87e2f3631b12cfa1118297d60e48935cb85ce2ce
 *
 * @type {Object}
 * @api private
 */
Fuzzer.responders = Object.create(null);

Fuzzer.responders.CLIENT_ERROR = function fabricate(config, done) {
  // do CLIENT_ERROR <error> \r\n
  var errors = [
      'Illegal slab id'
    , 'bad command line format'
    , 'bad command line format.  ' // these spaces are in the actual server source..
    , 'bad command line'
    , 'bad data chunk'
    , 'cannot increment or decrement non-numeric value'
    , 'invalid exptime argument'
    , 'invalid numeric delta argument'
    , 'slab reassignment disabled'
    , 'usage: stats detail on|off|dump'
    , (g.string() + g.string() + g.string()).replace('\r\n', '')
    , (g.string() + g.string() + g.string()).replace('\r\n', '')
    , (g.string() + g.string() + g.string()).replace('\r\n', '')
    , (g.string() + g.string() + g.string()).replace('\r\n', '')
    , (g.string() + g.string() + g.string()).replace('\r\n', '')
  ];

  done(undefined, 'CLIENT_ERROR '+ errors[ Math.floor(Math.random() * errors.length) ] +'\r\n');
};

Fuzzer.responders.SERVER_ERROR = function fabricate(config, done){
  // do SERVER_ERROR <error> \r\n
  var errors = [
      'Unhandled storage type.'
    , 'multi-packet request not supported'
    , 'object too large for cache'
    , 'out of memory making CAS suffix'
    , 'out of memory preparing response'
    , 'out of memory reading request'
    , 'out of memory storing object'
    , 'out of memory writing get response'
    , 'out of memory writing stats'
    , 'out of memory'
    , 'output line too long'
    , (g.string() + g.string() + g.string()).replace('\r\n', '')
    , (g.string() + g.string() + g.string()).replace('\r\n', '')
    , (g.string() + g.string() + g.string()).replace('\r\n', '')
    , (g.string() + g.string() + g.string()).replace('\r\n', '')
    , (g.string() + g.string() + g.string()).replace('\r\n', '')
  ];

  done(undefined, 'SERVER_ERROR '+ errors[ Math.floor(Math.random() * errors.length) ] +'\r\n');
};

Fuzzer.responders.STAT = function fabricate(config, done){
  var STAT = [
      'STAT pid '+ g.size()
    , 'STAT uptime '+ g.size()
    , 'STAT time '+ Date.now()
    , 'STAT version '+ g.size()+'.'+ g.size() +'.'+ g.size()
    , 'STAT libevent 2.0.17-stable'
    , 'STAT pointer_size '+ g.size()
    , 'STAT rusage_user '+ Math.tan((Math.random() - 0.5) * Math.PI)
    , 'STAT rusage_system '+ Math.tan((Math.random() - 0.5) * Math.PI)
    , 'STAT curr_connections '+ g.size()
    , 'STAT total_connections '+ g.size()
    , 'STAT connection_structures '+ g.size()
    , 'STAT reserved_fds '+ g.size()
    , 'STAT cmd_get '+ g.size()
    , 'STAT cmd_set '+ g.size()
    , 'STAT cmd_flush '+ g.size()
    , 'STAT cmd_touch '+ g.size()
    , 'STAT get_hits '+ g.size()
    , 'STAT get_misses '+ g.size()
    , 'STAT delete_misses '+ g.size()
    , 'STAT delete_hits '+ g.size()
    , 'STAT incr_misses '+ g.size()
    , 'STAT incr_hits '+ g.size()
    , 'STAT decr_misses '+ g.size()
    , 'STAT decr_hits '+ g.size()
    , 'STAT cas_misses '+ g.size()
    , 'STAT cas_hits '+ g.size()
    , 'STAT cas_badval '+ g.size()
    , 'STAT touch_hits '+ g.size()
    , 'STAT touch_misses '+ g.size()
    , 'STAT auth_cmds '+ g.size()
    , 'STAT auth_errors '+ g.size()
    , 'STAT bytes_read '+ g.size()
    , 'STAT bytes_written '+ g.size()
    , 'STAT limit_maxbytes '+ g.size()
    , 'STAT accepting_conns '+ g.size()
    , 'STAT listen_disabled_num '+ g.size()
    , 'STAT threads '+ g.size()
    , 'STAT conn_yields '+ g.size()
    , 'STAT hash_power_level '+ g.size()
    , 'STAT hash_bytes '+ g.size()
    , 'STAT hash_is_expanding '+ g.size()
    , 'STAT expired_unfetched '+ g.size()
    , 'STAT evicted_unfetched '+ g.size()
    , 'STAT bytes '+ g.size()
    , 'STAT curr_items '+ g.size()
    , 'STAT total_items '+ g.size()
    , 'STAT evictions '+ g.size()
    , 'STAT reclaimed '+ g.size()
  ].join('\r\n');

  // generate a bunch of STAT <key> <value> calls
  done(undefined, STAT +'\r\nEND\r\n');
};

[
  { response: 'DELETED' }
, { response: 'END' }
, { response: 'ERROR' }
, { response: 'EXISTS' }
, { response: 'NOT_FOUND' }
, { response: 'NOT_STORED' }
, { response: 'OK' }
, { response: 'STORED' }
, { response: 'TOUCHED'}
].forEach(function single(api) {
  var value = api.response;

  Fuzzer.responders[value] = function fabricate(config, done){
    done(undefined, value +'\r\n');
  };

  Fuzzer.responders[value].weight = api.weight || 0;
});

var values = [];
setTimeout(function () {
  // Parser hell, all values, separated by new lines
  values.push(Object.keys(Fuzzer.responders).join('\r\n'));
}, 0);

Fuzzer.responders.VALUE = function fabricate(config, done){
  var cas = Math.floor(Math.random() * 20) % 2
    , size = Math.floor(Math.random() * config.get('max value size'))
    , keysize = Math.floor(Math.random() * config.get('max key size'))
    , set = Math.floor(Math.random() * 5)
    , res = ''
    , response
    , length
    , key;

  // Did we need to generate a cas value?
  if (cas) cas = Math.floor(Math.random() * config.get('responses'));
  if (!set) set = 1;

  // generate a custom key
  key = (g.string() + g.string() + g.string()).replace(/\s/g, '').slice(0, keysize);

  if (values.lenth >= config.get('unique values')) {
    while (set--) {
      response = values[Math.floor(Math.random() * values.length)];
      size = Buffer.byteLength(response);

      // @TODO slice off the key from the content
      res += 'VALUE '+ key +' 0 '+ size + (cas ? ' '+ cas : '')
        + '\r\n'
        + response +'\r\n';
    }

    res += 'END\r\n';
    return done(undefined, res);
  }

  // do value <key> <flags> <bytes> [optional cas]\r\n data\r\nEND\r\n
  // should also send multipe value's
  response = new Buffer(size);
  fs.open('/dev/urandom', 'r', function (err, fd) {
    if (err) {
      fs.closeSync(fd);
      return done(err);
    }

    fs.read(fd, response, 0, size, 0, function reading(err) {
      if (err) {
        fs.closeSync(fd);
        return done(err);
      }

      length = config.get('max value size') - response.length;
      response = response.toString('utf-8');

      // trololol, add memcached ASCII commands, to ensure that values are parsed
      // correctly
      if (length) {
        response += Object.keys(Fuzzer.responders).join('\r\n').slice(0, length);
      }

      size = Buffer.byteLength(response);
      values.push(response);
      done(
          undefined
        , 'VALUE '+ key +' 0 '+ size + (cas ? ' '+ cas: '')
        + '\r\n'
        + response +'\r\nEND\r\n'
      );
    });
  });
};

Fuzzer.responders.VERSION = function fabricate(config, done){
  var major = Math.floor(Math.random() * 20)
    , minor = Math.floor(Math.random() * 20)
    , patch = Math.floor(Math.random() * 20);

  // do VERSION <semver>\r\n
  done(undefined, 'VERSION '+ major +'.'+ minor +'.'+ patch +'\r\n');
};

Fuzzer.responders.INCR = function fabricate(config, done) {
  // do <digit>
  done(undefined, Math.floor(Math.random() * Math.floor(Math.random() * 1000000)) +'\r\n');
};

/**
 * Creates a new Fuzzer instance.
 *
 * @param {Object} options
 * @api public
 */
exports.createServer = function createServer(options) {
  return new Fuzzer(options);
};

/**
 * Expose the Server instance.
 *
 * @api private
 */
exports.Server = Fuzzer;
