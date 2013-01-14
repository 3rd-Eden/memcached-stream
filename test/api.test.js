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
});
