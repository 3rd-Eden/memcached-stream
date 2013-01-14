'use strict';

var Server = require('net').Server;

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
  this.config.set('interval', 100);             // each x send a new response
  this.config.set('respones', 25000);           // the amount of responses to send
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
  var interations = 0
    , interval;

  interval = setInterval(function write() {
    if (++interations >= this.config.get('responses')) {
      if (this.config.get('auto close')) socket.end();

      return clearInterval(interval);
    }

    this.random(socket);
  }.bind(this), this.config.get('interval'));

  //
  // Make sure we clear the interval once
  socket.once('end', function theend() {
    clearInterval(interval);
  });
};

/**
 * Write a fuzzy line to the given socket connection.
 *
 * @param {net.Server} socket
 * @api private
 */
Fuzzer.prototype.random = function random(socket) {
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
    socket.write(line);
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
  ];

  done(undefined, 'SERVER_ERROR '+ errors[ Math.floor(Math.random() * errors.length) ] +'\r\n');
};

Fuzzer.responders.STAT = function fabricate(config, done){
  // generate a bunch of STAT <key> <value> calls
  done(undefined, 'STORED\r\n');
};

[
  'DELETED'
, 'END'
, 'ERROR'
, 'EXISTS'
, 'NOT_FOUND'
, 'NOT_STORED'
, 'OK'
, 'STORED'
, 'TOUCHED'
].forEach(function single(api) {
  var value = api.response;

  Fuzzer.responders[value] = function fabricate(config, done){
    done(undefined, value +'\r\n');
  };

  Fuzzer.responders[value].weight = api.weight || 0;
});

Fuzzer.responders.VALUE = function fabricate(config, done){
  // do value <key> <flags> <bytes> [optional cas]\r\n data\r\nEND\r\n
  // should also send multipe value's

  done(undefined, 'VALUE key 0 1\r\na\r\nEND\r\n');
};

Fuzzer.responders.VERSION = function fabricate(config, done){
  // do VERSION <semver>\r\n
  done(undefined, 'VERSION 0.0.0\r\n');
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
