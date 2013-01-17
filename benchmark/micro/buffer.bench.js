'use strict';

/**
 * Benchmark related modules.
 */
var benchmark = require('benchmark')
  , microtime = require('microtime');

/**
 * Logger
 */
var logger = new(require('devnull'))({ timestamp: false, namespacing: 0 });

/**
 * Preparation code.
 */
var reuse = new Buffer(1048576)
  , read = require('fs').readFileSync
  , decoder = new (require('string_decoder').StringDecoder)('utf8')
  , base = read(__filename);

(
  new benchmark.Suite()
).add('Buffer#concat', function test1() {
  var x = Buffer.concat([base, base]).toString('utf8');
}).add('StringDecoder', function test2() {
  var x = decoder.write(base) + decoder.write(base);
}).add('StringDecoder to buffer', function test2() {
  var x = new Buffer(decoder.write(base) + decoder.write(base))
}).add('reuse & Buffer#copy', function test2() {
  base.copy(reuse, 0);
  base.copy(reuse, base.length);

  var x = reuse.toString('utf8');

}).on('cycle', function cycle(e) {
  var details = e.target;

  logger.log('Finished benchmarking: "%s"', details.name);
  logger.metric('Count (%d), Cycles (%d), Elapsed (%d), Hz (%d)'
    , details.count
    , details.cycles
    , details.times.elapsed
    , details.hz
  );
}).on('complete', function completed() {
  logger.info('Benchmark: "%s" is was the fastest.'
    , this.filter('fastest').pluck('name')
  );
}).run();
