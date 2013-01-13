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
var arr = [];
arr[100] = [10, 0];
arr[101] = [10, 0];
arr[103] = [10, 0];
arr[105] = [10, 0];

var nulled = Object.create(null);
nulled[100] = [10, 0];
nulled[101] = [10, 0];
nulled[103] = [10, 0];
nulled[105] = [10, 0];

var obj = {};
obj[100] = [10, 0]
obj[101] = [10, 0];
obj[103] = [10, 0];
obj[105] = [10, 0];

(
  new benchmark.Suite()
).add('array index lookup', function test1() {
  var x;

  for (var i = 100; i < 106; i++) {
    x = arr[i];
  }
}).add('null idex lookup', function test2() {
  var x;

  for (var i = 100; i < 106; i++) {
    x = nulled[i];
  }
}).add('obj idex lookup', function test2() {
  var x;

  for (var i = 100; i < 106; i++) {
    x = obj[i];
  }
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
