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

var read = require('fs').readFileSync
  , buff = read(__filename)
  , string = buff.toString();

require('buffertools'); // adds indexOf
(
  new benchmark.Suite()
).add('string#indexOf & slice', function test1() {
  var data = string
    , content
    , value
    , flags
    , key;

  for (var i = 0, length = data.length; i < length; i++) {
    if (data.charCodeAt(i) === 115 && data.charCodeAt(i+1) === 116) {
      i += 6;

      key = data.slice(i, data.indexOf(' ', i));
      i += key.length + 1;

      flags = data.slice(i, data.indexOf(' ', i));
      i += flags.length + 1;

      //value = data.slice(i, 400);
      value = new Buffer(400);
      value.write(data, 0, 400);
      content = value.toString();
    }
  }

  //data += string;
}).add('buffer#indexOf & slice', function test2() {
  var data = buff
    , content
    , value
    , flags
    , key;

  try {
  for (var i = 0, length = data.length; i < length; i++) {
    if (data[i] === 115 && data[i+1] === 116) {
      i += 6;

      key = data.slice(i, data.indexOf(' ', i));
      i += key.length + 1;

      flags = data.slice(i, data.indexOf(' ', i));
      i += flags.length + 1;

      value = data.slice(i, i + 400);
      content = value.toString();
    }
  }
  } catch (e) {
    if (read.err) return;
    read.err = e;
    console.log(e.message, e.stack);
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
