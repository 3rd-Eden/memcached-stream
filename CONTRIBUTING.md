# Contributing to memcached-stream

First of all I would like to thank you for your interest in contributing the
`memcached-stream` project. Together we can make this the fastest and most
reliable memcached parser for Node.js. While a CONTRIBUTING file might
intimidating at first, I hope you will understand that I enforce this to maintain
the quality of this project.

### Pull requests without tests will not be accepted and closed immediately

When you are making an change to the internals of this project it's expected
that your patch is accompanied with a test/suite that ensures that tests the
change you have made so this will not happen again in the future. Rewrite and
refactor are usually the cause that small bugs slip in, therefor it's important
that these bugs are prevented by an extensive test suite.

### All tests must pass

We have tests for a reason, make sure that they keep passing after you made your
changes. If this is not the case please thoroughly explain why the test is
faulty and why your change needs to break it.

### The lack of code comments for edge cases

I love to have the code thoroughly documented, so it lower the barrier of
contribution.
