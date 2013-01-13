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
var str = require('fs').readFileSync(__filename, 'utf8')
  , size = str.length;

(
  new benchmark.Suite()
).add('str.charCodeAt(0)', function test1() {
  for (var i = 0, y; i < size; i++) {
    y = str.charCodeAt(i);

    if (y === 106) y = null;
  }
}).add('str.charAt(0)', function test1() {
  for (var i = 0, y; i < size; i++) {
    y = str.charAt(i);

    if (y === 'j') y = null;
  }
}).add('str[index]', function test2() {
  for (var i = 0, y; i < size; i++) {
    y = str[i];

    if (y === 'j') y = null;
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
