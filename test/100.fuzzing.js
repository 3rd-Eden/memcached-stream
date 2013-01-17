'use strict';

var parser = require('../index.js').createStream()
  , fuzzer = require('./fuzzer').createServer({
        'responses': 100000
      , 'max value size': 256
      , 'replies': [
            'CLIENT_ERROR'
        ]
    });

//
// The fuzzer emit's when it writes a line, store it so we can test against them
//
var send = [];
fuzzer.on('fuzzer', function (code, line) {
  // minor
  send.push({ code: code, line: line });
});

//
// The parser recieved the an command
//
var responses = 0
  , last;

parser.on('response', function (code, value) {
  var expecting = send.shift();

  responses++;
  process.stdout.write('Parsed response: '+ responses +'\r');

  if (
      !~code.indexOf(expecting.code)
    && (value ? !~expecting.line.indexOf(value) : false)
  ) {
    console.log('Failed to parse', expecting, 'got '+ code);
    console.log('Parsed: ', responses);
    console.log('Last: ', last);
    process.exit(1);
  }

  last = expecting;
  last.parsedCode = code;
  last.value = value;
});

parser.on('error', function (err) {
  var expecting = send.shift()
    , code = err.code;

  responses++;
  process.stdout.write('Parsed response: '+ responses +'\r');

  if (code !== expecting.code) {
    console.log('Failed to parse', expecting, 'got error '+ code);
    console.log('Parsed: ', responses);
    console.log('Error: ', err.message);
    console.log('Last: ', last);

    //if (err.data) console.log('Data: ', err.data);

    process.exit(1);
  }

  last = expecting;
  last.parsedCode = code;
  last.value = err.message;
});

fuzzer.listen(11211, function () {
  require('net').connect(11211).pipe(parser);
});
