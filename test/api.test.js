/*global portnumbers*/
describe('memcached-stream', function () {
  'use strict';

  var chai = require('chai')
    , expect = chai.expect;

  chai.Assertion.includeStack = true;

  var net = require('net')
    , fuzzy = require('./fuzzer')
    , stream = require('../index')
    , Parser = stream.Parser;

  it('exposes the parser', function () {
    expect(stream.Parser).to.be.a('function');
  });

  describe('Parser', function () {
    describe('@constructor', function () {
      it('constructs without any errors', function () {
        var memcached = new Parser();
      });

      it('applies the given options', function () {
        var memcached = new Parser({ readable: false });

        expect(memcached.readable).to.equal(false);
      });
    });

    describe('#write', function () {
      it('should return true after a succesful write', function () {
        var memcached = new Parser();

        expect(memcached.write('END\r\n')).to.equal(true);
      });
    });

    describe('#pipe', function () {
      it('pipes to a net.Connection', function (done) {
        var server = fuzzy.createServer({ responses: 100 })
          , memcached = new Parser()
          , port = portnumbers
          , responses = 0;

        this.timeout(20E3);

        memcached.on('error', function () {
          ++responses;
        });

        memcached.on('response', function () {
          ++responses;
        });

        server.listen(port, function (err) {
          if (err) return done(err);

          var connection = net.connect(port);
          connection.pipe(memcached);

          connection.once('close', function () {
            server.close();

            expect(responses).to.equal(100);
            done();
          });
        });
      });
    });
  });
});
