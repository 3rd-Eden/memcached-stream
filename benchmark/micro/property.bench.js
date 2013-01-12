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
function Foo() {
  this.readable = true;
}

function Bar() {
}

Bar.prototype.readable = true;

(
  new benchmark.Suite()
).add('assigning propertys on `this`', function test1() {
  var x = new Foo()
    , y;

  if (x.readable) y = x.readable;
}).add('assigning propertys on the prototype', function test2() {
  var x = new Bar()
    , y;

  if (x.readable) y = x.readable;
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
