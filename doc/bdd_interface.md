# Writing tests using the BDD interface

The syntax of writing tests with Overman is configurable, but the default
option is the BDD interface. It attempts to be compatible with Mocha's BDD
interface, but because Overman is wired a bit differently from Mocha, not all
tests written for Mocha will work out-of-the-box on Overman.

## Where to put test files

The test code can be in any file in any path. By convention they reside in a
directory `test` in the top level of the project. A common structure is to have
one test file per source file, but the layout can be anything that makes sense
for the project.

## Tests

A test file with a single test looks like this:

```javascript
it('should be a test', function() {
  // Put test code here
});
```

A test file can have any number of tests.

It is illegal to have two tests in the same file, in the same suite with the
same name:

```javascript
// The following code will result in an error when Overman is calculating the
// list of tests to be run:
it('should succeed', function() {});
it('should succeed', function() {});
```

### Attributes

A test with custom optional attributes looks like this:

```javascript
it('should be a test', { requirements: 'Requirement1' }, function() {
  // Put test code here
});
```

## Assertions

Overman does not provide utilities for asserting conditions in tests. Typically
when writing tests with Overman, an external assertion library is used. Here are
some assertion libraries that can be used:

* [Chai](http://chaijs.com): BDD or TDD style asserts.
* [should.js](https://github.com/shouldjs/should.js): BDD style assertions.
* [Expect](https://github.com/Automattic/expect.js): Minimalistic BDD style assertions.

Here's an example of a test that uses [Chai](http://chaijs.com):

```javascript
var expect = require('chai').expect;

it('should assert', function() {
  expect(Math.random()).to.be.within(0, 1);
});
```

## Suites

Tests in test files can be grouped together into suites:

```javascript
describe('Some functionality', function() {
  it('should work', function() {
    // Test something
  });

  it('should do the right thing', function() {
    // Test something else
  });
});
```

Suites can be nested:

```javascript
describe('Some functionality', function() {
  describe('A certain aspect', function() {
    it('should work', function() {
      // Test something
    });
  });
});
```

## Skipping and exclusively running tests

Tests can be skipped with `it.skip`:

```javascript
it.skip('should not be run', function() {
  // Will not be run
});
```

Tests that don't yet have an implementation can be written by not passing in a
test function. This has the same effect as skipping the test:

```javascript
it('should be tested at some future point in time');
```

While working on tests, it is sometimes useful to run only a certain test. That
can be done with `it.only`:

```javascript
it.only('should be run and all other tests should not', function() {
  // Test something
});
```

Overman supports marking more than one test with `.only`. `.skip` and `.only`
can be used for test suites as well, using `describe.skip` and `describe.only`.

## Before and after hooks

It is often useful to de-duplicate test code by adding code that is run before
or after more than one test. In order to achieve this, Overman's BDD interface
provides `beforeEach` and `afterEach`.

```javascript

beforeEach(function() {
  // Will be run before all tests  
});

it('should succeed', function() {
  // ...
});

afterEach(function() {
  // Will be run after all tests
});
```

Hooks can be named. This is makes the code more self-documenting and can help
when troubleshooting test failures:

```javascript
beforeEach('Log in', function() {
  // Log in
});

beforeEach(function initiateDatabase() {
  // Initiate the database
});
```

Hooks can be defined within suites. Then they are only run for tests in that
suite:

```javascript
beforeEach(function() {
  // When this test file is tested, this hook will be invoked twice.
});

it('should succeed', function() {});

describe('Something', function() {
  beforeEach(function() {
    // When this test file is tested, this hook will be invoked once.
  });

  it('should also succeed', function() {});
});
```

With before hooks, the top level suite hooks are run first, then the suite below
that etc. With after hooks, the order is reversed: The most specific suite's
after hooks are run first, and the top level suite's after hooks are run last.
Hooks within a given suite or subsuite are run in the order they are specified.

Like tests, before and after hooks can be synchronous or asynchronous. Both the
`done` style of asynchrony, promises and generators are supported.

When a before hook fails, subsequent before hooks and the test will not be run.

All after each hooks are always run, even if the test or any other before or
after hook fails, or if the test times out. This means you sometimes have to
code defensively in the after hooks.

`beforeEach` and `afterEach` hooks don't only help with deduplication, they also
behave differently to running that code inside the test in other ways:

* When the hooks fail, Overman will report that the failure is in the hook, and
  the name of the hook that failed. This can aid troubleshooting.
* Overman times the run time of all tests. Before and after hooks are not
  included in this time.

For compatibility with Mocha, `before` and `after` are also provided as aliases
for `beforeEach` and `afterEach`. Because Overman always runs only one test per
Node process, there is no difference between them. Their use is discouraged, but
they can be useful when writing tests that work with both Mocha and Overman.

## Asynchronous tests

Overman's speciality is tests that are a bit more complex and run a little
longer than a typical unit test. Because of this, support for asynchronous tests
is very important for Overman.

### done

In addition to synchronous tests, overman supports two styles of asynchronous
tests. One is using a `done` callback:

```javascript
it('should invoke setTimeout callback', function(done) {
  setTimeout(function() {
    done();
  }, 10);
});
```

Failure is expressed by passing in an `Error` object to the `done` callback:

```javascript
it('should fail asynchronously', function(done) {
  setTimeout(function() {
    done(new Error('Failure'));
  }, 10);
});
```

It is acceptable to invoke `done` synchronously:

```javascript
it('should fail asynchronously', function(done) {
  done();
});
```

It is an error to invoke `done` more than once:

```javascript
it('should fail asynchronously', function(done) {
  done();
  done();  // This will cause the test to fail
});
```

Note, however, that once a test succeeds, the process that runs it will exit, so
Overman will not always detect tests that were going to invoke `done` more than
once:

```javascript
it('should call done twice, but with a long delay', function() {
  done();
  // In this case, the test will have finished and the node process exited
  // before the callback is run, so this will not cause the test to fail.
  setTimeout(function() { done(); }, 10000);
});
```

Tests functions that don't take 0 arguments are assumed to be of the
asynchronous `done` style, regardless of the name of the parameter.

```javascript
it('should time out', function(options) {
  // The "options" parameter is the done callback here. Because we don't call
  // it, the test will always time out.
});

it('should fail', function() {
  var done = arguments[0];
  // Here, done will be undefined so the test will fail. Only if the test
  // function takes an argument will it be counted as a done callback test.
  done();
});
```

### Promises

Overman also supports promise style asynchronous tests. When a test function
returns a promise-like object, the test result will be the value of the promise:

```javascript
it('should succeed', function() {
  return new Promise(function(resolve) {
    setTimeout(resolve, 100);
  });
});
```

### Generators

In node 0.11+ and iojs, overman offers support for writing tests with
[co](https://github.com/tj/co) style asynchronous generators. When a test
function returns a generator-like object, Overman uses `co` to run the test.

```javascript
it('should use generators', function *() {
  if ((yield Promise.resolve(1)) != (yield Promise.resolve(1))) {
    throw new Error('Insanity!');
  }
});
```

## The context

There are certain more advanced ways to manipulate Overman's behavior that is
achieved by accessing the `Context` object. From tests and hooks it can be
accessed with `this`:

```javascript
beforeEach(function() {
  var theContext = this;
});

it('should get the Context', function() {
  var theContext = this;
});
```

The `Context` is also accessible with the global variable `context`.

### Attributes

A test get its attributes like this:

```javascript
it('should be a test', { requirement: 'Requirement1' }, function() {
  console.log(this.attributes.requirement);
});
```

### Accessing the timeout

A test can get and modify its timeout using the `timeout` method on the
`Context`. Getting the timeout can be useful for example for setting TTLs of
locks that tests acquire, setting the timeout can be useful if a certain test
takes particularly long time to run.

```javascript
it('should print its timeout', function() {
  console.log(this.timeout());
});

it('should set its timeout', function() {
  this.timeout(1000);  
});
```

Timeouts for tests can also be overriden on the suite level:

```javascript
describe('A suite', function() {
  this.timeout(10000);  // Set the timeout for all tests in this suite
  console.log(this.timeout());
});
```

The return value of `this.timeout()` is not defined if the value has not been
overridden. (In the future this might be the global timeout, but that is not
currently implemented.)

### Accessing the title

You may access the title or the full title inside `beforeEach`, `it` and `afterEach`
by referring to this.title or this.currentTest.title. The difference between full
title and title is that the full title includes all the describe strings concatenated
by the ':' character.

### Accessing the slow threshold

Some Overman reporters, for example the spec reporter, will mark tests that are
slow in a special way. Tests that take longer time than a certain threshold will
be marked as slow, and tests that take longer than half of that threshold are
marked as "half slow".

Typically, this threshold is configured when the whole suite is run, but it can
be useful to increase the threshold for certain tests that are extra slow.

```javascript
it('should print its slow threshold', function() {
  console.log(this.slow());
});

it('should set its slow threshold', function() {
  this.slow(1000);  
});
```

Like timeouts, the slow threshold can be set on the suite level as well.

### Leaving breadcrumbs

When writing system tests, one often has no choice but to write tests that fail
by timing out. This can lead to horrible error reporting, where the only thing
you get to know is that the test timed out, which really can mean anything.

As a means of providing better error messages, Overman lets tests leave
"breadcrumbs". When a test times out (or when an uncaught exception is thrown),
a test reporter can say not only that the test timed out, but what the last
breadcrumb was. With strategically placed breadcrumbs, it can be significantly
quicker to pin down where the test went wrong.

Breadcrumbs consist of a message and the stack trace of where they were
generated.

```javascript
it('should leave a breadcrumb', function() {
  this.breadcrumb('Did begin');
});
```

### Emitting debug information

It is sometimes desirable to emit extra information about tests. This could for
example be paths to log files, the username/password that was used in a test,
a count of something that should be plotted as a graph etc.

Overman itself does not do anything with this debug information; to use it, you
need to write a custom reporter that takes care of the information. One
real-world use case of this feature is to take information and dump it to a
logstash host with Kibana for quick and powerful graphing.
