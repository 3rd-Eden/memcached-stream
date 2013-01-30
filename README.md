# memcached-stream [![Build Status](https://travis-ci.org/3rd-Eden/memcached-stream.png?branch=master)](https://travis-ci.org/3rd-Eden/memcached-stream)

Memcached-stream is a streaming [Memcached ASCII protocol][ascii] parser for
Node.js. The module is build with performance in mind and features an extensive
micro benchmark suite that was used to research the best way to parse the stream
of incoming data. My work on an Memcached ASCII parser originally started out
for my [node-memcached][memcached] module. I decided to extract it out so it can
be reused by different servers that are now using the Memcached protocol to
communicate such as:

- Couchbase, Database
- MySQL InnoDB, Database
- Kestrel, Message Queue
- darner, Message Queue

The parser has been build on top of the Node.js stream interface so it can take
advantage of the `Stream#pipe` method to work it's parsing magic. The parser
assumes that you have set the encoding of the connection to UTF-8 using the
`Stream#setEncoding` method, this ensures that we will not destroy multi-byte
strings and that your data is intact.

#### Why ASCII

The reason that I have chosen to support the ASCII protocol is that its easier
to debug. This might sound silly to you, but being able to see what is actually
being send over the network in a human readable format is priceless when you
have to debug something in production.

[memcached]: /3rd-Eden/node-memcached
[ascii]: https://github.com/memcached/memcached/blob/master/doc/protocol.txt

### Installation

Install the module using the Node Package Manager (NPM):

```
npm install memcached-stream --save
```

The `--save` flag tells NPM to automatically add the package to your
`package.json`.

### API

All the examples assume the following boot strapped code:

```js
var Parser = require('memcached-stream');
```

And we assume that the `stream` variable is a valid TCP connection that already
had `setEncoding('utf-8')` applied to it so it will not terminate UTF-8 chars.

#### Initializing the parser

The parser inherits from the Node.js Stream interface. This allows you to easily
attach the parser to a connection by using the `Stream#pipe` method which is
available on every Stream interface in node. The best thing about using the pipe
method is that it takes care of all the flow control for us.

```js
var parser = new Parser();

stream.pipe(parser);
```

#### Adding optional flag parsers

Memcached allows you to store 16 / 32 bits unsigned integers as flags when you
store your response. This is mostly used to indicate what kind of data is
actually stored.

The flag function takes 2 arguments:

- flag, an unsigned 16 or 32 bit integer (depends on your memcached version)
- parser, an function that receives 2 arguments:
  - str, the string representation of the value
  - buffer, the buffer representation of the value.
  
_Please note that this is a sync call._

```js
// a JSON parser for when the 1 flag is used
parser.flag(1, function parse(str, buffer) {
  return JSON.parse(str);
});
```

#### Listening for the parser's events

The parser emit's a couple of events that you should be listening on:

- **response** The parser has received a new response from the server
- **error:response** The parser received an Error response from the server
- **error** The parser is in a horrible state, and should be killed.

##### The response event

The first 2 arguments of this are the most important. The first argument
`command` is the response command that was returned from the server. It would be
VALUE, END, OK, NOT_STORED etc. The second argument is the value of the
response. This is the same for every response. Most responses will be a
`Boolean` value. This will indicate if the command indicates success or failure.

Non `boolean` responses should probably be queued until you receive an `END`
command. This only applies for VALUE, STAT and KEY. These commands also receive
a couple of extra arguments.

- **VALUE**
  - command, command name
  - value, the value
  - flags, the flags of the response
  - cas, an optional cas key
  - key, the key of the value
- **STAT**
  - command, command name
  - key, the stat key
  - value, the stat value

The **KEY** response here is the odd ball, where it's value is key. Please note
that the KEY response isn't offically support by memcached.

```js
parser.on('response', function response(command, ..args) {
  // command is the response type, VALUE, END, STORED etc.
});
```

##### The error:response event

The error response is still a response from the server, this is a sepeare event
as it will recieve an Error argument. This error argument you can easily pass to
your callback functions. The `error:response` is only called for known error
responses from a memcached server such as ERROR, CLIENT_ERROR and SERVER_ERROR.

```js
parser.on('error:response', function error(err) {
  // err.code is the actual response type
});
```

##### The error event

In addition to these events, we also have an `error` event that gets emitted
when we receive an unknown response. When this happens the parser is destroyed
immediately as we have no idea in what state our parser is in.

```js
parser.on('error', function error(err) {
  // optionally you can check the cause of the error, if it's due to a parser
  // failure it will have a `code` property
  parser.destroy();

  // rebuild the parser and pipe it the connection again
});
```

#### Finishing it up

Once you are done with parsing you can terminate it by calling:

```js
parser.end();
```

Or you can completely destroy the parser by calling:

```js
parser.destroy();
```

### Contributing

Please see the CONTRIBUTING.md

### LICENSE

MIT
