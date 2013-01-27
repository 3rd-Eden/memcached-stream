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
var bool = true
  , toString = Object.prototype.toString;

(
  new benchmark.Suite()
).add('typeof equal', function test1() {
  var x;

  if (typeof bool === 'boolean') {
    x = bool;
  } else if (typeof bool === 'number') {
    x = 1;
  }
}).add('typeof charAt', function test2() {
  var x;

  if ((typeof bool).charCodeAt(0) === 98) {
    x = bool;
  } else if ((typeof bool).charCodeAt(0) === 110) {
    x = 1;
  }
}).add('toString equal', function test2() {
  var x;

  if (toString.call(bool) === '[object Boolean]') {
    x = bool;
  } else if (toString.call(bool) === '[object Number]') {
    x = 1;
  }
}).add('typeof charAt', function test2() {
  var x;

  if (toString.call(bool).charCodeAt(8) === 66) {
    x = bool;
  } else if (toString.call(bool).charCodeAt(8) === 78) {
    x = 1;
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
