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
var str = 'foo, bar, \r\nfoo, bar, \r\nfoo, bar, ';

(
  new benchmark.Suite()
).add('str.indexOf(data)', function test1() {
  var index = str.indexOf('\r\n');
}).add('str.indexOf(data, pos)', function test2() {
  var index = str.indexOf('\r\n', 12);
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
