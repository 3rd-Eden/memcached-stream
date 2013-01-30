'use strict';

var parser = new (require('../').Parser)()
  , control = require('fs').readFileSync('./responses', 'utf8');

//
// Stress test parameters
//
var NR_OF_RUNS = 100;

var start = Date.now();

for (var i = 0; i < NR_OF_RUNS; i++) {
  parser.write(control);
}

var end = Date.now()
  , timespend = end - start
  , bytes = Buffer.byteLength(control) * NR_OF_RUNS;

console.log(timespend + ' ms');
console.log(bytes/timespend + ' bytes/ms');
