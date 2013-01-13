describe('memcached-stream', function () {
  'use strict';

  var chai = require('chai')
    , expect = chai.expect;

  chai.Assertion.includeStack = true;

  var stream = require('../index')
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
  });

  describe('Protocol', function () {
    describe('CLIENT_ERROR', function () {
      var data = 'CLIENT_ERROR Syntax error: cas <key> <flags> <exptime> <bytes> <casid> [noreply]\r\n';

      it('emits an `error` event when encountered', function (done) {
        var memcached = new Parser();

        memcached.on('error', function (err) {
          expect(err).to.be.an.instanceOf(Error);
          expect(err.message).to.include('Syntax error');
          expect(err.message).to.include('cas <key>');

          done();
        });

        memcached.write(data);
      });
    });

    describe('SERVER_ERROR', function () {
      var data = 'SERVER_ERROR out of memory storing object with memcached\r\n';

      it('emits an `error` event when encountered', function (done) {
        var memcached = new Parser();

        memcached.on('error', function (err) {
          expect(err).to.be.an.instanceOf(Error);
          expect(err.message).to.include('out of memory');
          expect(err.message).to.include('storing object');

          done();
        });

        memcached.write(data);
      });
    });

    describe('DELETE', function () {
      var data = 'DELETED\r\n';

      it('emits an `response` event when encountered', function (done) {
        var memcached = new Parser();

        memcached.on('response', function (command) {
          expect(command).to.equal('DELETED');
          done();
        });

        memcached.write(data);
      });
    });

    describe('END', function () {
      var data = 'END\r\n';

      it('emits an `response` event when encountered', function (done) {
        var memcached = new Parser();

        memcached.on('response', function (command) {
          expect(command).to.equal('END');
          done();
        });

        memcached.write(data);
      });
    });

    describe('ERROR', function () {
      var data = 'ERROR\r\n';

      it('emits an `error` event when encountered', function (done) {
        var memcached = new Parser();

        memcached.on('error', function (err) {
          expect(err).to.be.an.instanceOf(Error);
          expect(err.message).to.include('Command not known');
          expect(err.message).to.include('by server');

          done();
        });

        memcached.write(data);
      });
    });

    describe('EXISTS', function () {
      var data = 'EXISTS\r\n';

      it('emits an `response` event when encountered', function (done) {
        var memcached = new Parser();

        memcached.on('response', function (command) {
          expect(command).to.equal('EXISTS');
          done();
        });

        memcached.write(data);
      });
    });

    describe('NOT_FOUND', function () {
      var data = 'NOT_FOUND\r\n';

      it('emits an `response` event when encountered', function (done) {
        var memcached = new Parser();

        memcached.on('response', function (command) {
          expect(command).to.equal('NOT_FOUND');
          done();
        });

        memcached.write(data);
      });
    });

    describe('NOT_STORED', function () {
      var data = 'NOT_STORED\r\n';

      it('emits an `response` event when encountered', function (done) {
        var memcached = new Parser();

        memcached.on('response', function (command) {
          expect(command).to.equal('NOT_STORED');
          done();
        });

        memcached.write(data);
      });
    });

    describe('OK', function () {
      var data = 'OK\r\n';

      it('emits an `response` event when encountered', function (done) {
        var memcached = new Parser();

        memcached.on('response', function (command) {
          expect(command).to.equal('OK');
          done();
        });

        memcached.write(data);
      });
    });

    describe('STORED', function () {
      var data = 'STORED\r\n';

      it('emits an `response` event when encountered', function (done) {
        var memcached = new Parser();

        memcached.on('response', function (command) {
          expect(command).to.equal('STORED');
          done();
        });

        memcached.write(data);
      });
    });

    describe('TOUCHED', function () {
      var data = 'TOUCHED\r\n';

      it('emits an `response` event when encountered', function (done) {
        var memcached = new Parser();

        memcached.on('response', function (command) {
          expect(command).to.equal('TOUCHED');
          done();
        });

        memcached.write(data);
      });
    });

    describe('VERSION', function () {
      var data = 'VERSION 1.2.2\r\n';

      it('emits an `response` event when encountered', function (done) {
        var memcached = new Parser();

        memcached.on('response', function (command, data) {
          expect(command).to.equal('VERSION');
          expect(data).to.equal('1.2.2');
          done();
        });

        memcached.write(data);
      });
    });

  });
});
