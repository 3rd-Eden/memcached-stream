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
var arr = []
  , cursor = 0;

(
  new benchmark.Suite()
).add('push & shift', function test1() {
  arr.push(1);
  var x = arr.shift();
}).add('.length & shift', function test2() {
  arr[arr.length] = 1;
  var x = arr.shift();
}).add('unshift & pop', function test3() {
  arr.unshift(1);
  var x = arr.pop();
}).add('cursor, delete and push', function test4() {
   arr.push(1);

   var x = arr[cursor];
   delete arr[cursor];
   cursor++;
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
