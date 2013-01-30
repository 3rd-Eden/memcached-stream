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

#### Listening for results

Now that we attached the parser to the stream we can start receiving responses
from the memcached protocol enabled server:

```js
parser.on('response', function response(command, ..args) {
  // command is the response type, VALUE, END, STORED etc.
});

parser.on('error:response', function error(err) {
  // err.code is the actual response type
});
```

#### Unknown server responses

In addition to these events, we also have an `error` event that gets emitted
when we receive an unknown response. When this happens the parser is destroyed
immediately as we have no idea in what state our parser is in.

```js
parser.on('error', function (err) {
  // You should kill the connection and re construct the parser here.
});
```

#### Finishing it up

Once you are done with parsing you can terminate it by calling:


```js
parser.end();
```

### Contributing

Please see the CONTRIBUTING.md

### LICENSE

MIT
