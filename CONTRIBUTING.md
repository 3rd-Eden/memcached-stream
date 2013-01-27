# Contributing to memcached-stream

First of all I would like to thank you for your interest in contributing the
`memcached-stream` project. Together we can make this the fastest and most
reliable memcached parser for Node.js. While a CONTRIBUTING file might
intimidating at first, I hope you will understand that I enforce this to maintain
the quality of this project.

Thanks for being awesome.

## Creating issues

- [Test cases][1.1]
- [+1][1.2]
- [Respect][1.3]

[1.1]: #test-cases
[1.2]: #1
[1.3]: #respect

### Test cases

When you found a bug in the project please provide us with a reproducible test
case when possible. A test case allows us to narrow down the issue you are
facing and eliminates all confusion that the project maintainers might have and
prevents mis interpretation of the issue.

### +1

Please, don't +1 on an issue, if an issue affects you please state why you have
this issue and why you would love to see it resolved. When a topic is spammed
with `+1` messages it will be closed without any warning and ignored.

### Respect

Let's threat each other with the same respect that you would like to be threated
with. While it's an open source project it does not imply that the you get
support from the project managers because you use it. We are only human and  we put
all our love, passion and available time in open source projects so you don't
have to and spend your time on building amazing applications and software.

## Creating pull requests

- [No tests, no pull request][2.1]
- [All tests must pass][2.2]
- [The lack of comments][2.3]
- [Performance][2.4]
- [Communicate][2.5]

[2.1]: #pull-requests-without-tests-will-not-be-accepted-and-closed-immediately
[2.2]: #all-tests-must-pass
[2.3]: #the-lack-of-code-coments-for-edge-cases
[2.4]: #performance
[2.5]: #communicate

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

### Performance

Being fast and awesome are the major goals of this project, please benchmark
your changes before submitting them. Create a micro benchmark for your change if
needed, so we can re-test these performance benefits in the future as JavaScript
and Node.js are continuously evolving technologies and performance tricks of the
past might not longer apply any more.

### Communicate

Before starting on a big refactor or want to create a big feature for the
project discuss this with the project managers to prevent wasted time and pull
requests if your change gets deployed because it's out of the scope of the
project.
