# How to interpret error messages from Overman

When it comes to testing frameworks, what really separates the men from the boys is how useful the output is when the tests fail. In the development of Overman much effort has been put into making sure that it is capable of emitting good and informative error messages. This document describes how to interpret Overman's error messages and has some tips on how to write tests that are capable of providing good error information.


## Test execution errors

When tests fail, Overman will report that. It will say that the test failed (`In test:` printed in blue), which tells you that the failure was not in a hook or an uncaught exception.

When hooks fail, Overman will specifically tell that it was a hook that failed, for example `In after hook:` printed in blue. If you provided a name for the hook, that will be printed as well, for example `In before hook "beforeHook":`

A special way in which asynchronous tests can fail is that there may be uncaught exceptions that propagate all the way up to the node runloop. This does not normally happen in synchronous tests, because Overman will catch and report errors that are thrown from the main test function. Uncaught exceptions are detected by Overman and reported in a special way.

It is possible for a test to fail with multiple errors in a single test run. This can happen for example because after hooks are run even when the test fails.

Here is an example where a test fails, an after hook fails and an uncaught error is thrown, all in the same test:

```javascript
it('should do something', function(done) {
  setTimeout(function() {
    throw new Error('Break things');
  }, 200);

  throw new Error('Does not work');
});

afterEach(function failingAfterHook() {
  throw new Error('I refuse to work!');
});

afterEach('after hook that never completes', function(done) {
});
```

This causes Overman to print the following:

```

  ✖ should do something

  0 passing (0s)
  1 failing

  1) should do something:
     In test: Error: Does not work
       at Context.<anonymous> (/Users/peck/prog/overman/test/test_error.js:6:9)
       [[ stack trace elided ]]

     In after hook "failingAfterHook": Error: I refuse to work!
       at Context.failingAfterHook (/Users/peck/prog/overman/test/test_error.js:10:9)
       [[ stack trace elided ]]

     Uncaught error: Error: Break things
       at null._onTimeout (/Users/peck/prog/overman/test/test_error.js:3:11)
       [[ stack trace elided ]]

     Last breadcrumb: Starting after hook "after hook that never completes"

```

For more information about how to interpret breadcrumbs, please see the Breadcrumbs section of this document.


## Timeouts

Tests that take too long to run are terminated by Overman and are reported as tests that time out. Since Overman runs tests in separate sub-processes of the suite runner, Overman is able to detect infinite loops in tests.

Tests that time out will be reported as such. Additionally, Overman will say in which phase of the test it was when the test timed out (in a hook or in the test).

When tests time out, after hooks are run, but no further reporting is done. This is done in order to let reporters live in the illusion that when tests time out, that's the last thing that happened to the test.

```javascript
it('should loop infinitely', function() {
  for (;;);
});

afterEach('after hook that never completes', function(done) {
  console.log('-- This is printed to stdout');
  throw new Error('Oh no');  // This error is swallowed
});
```

fails with

```

  ⧖ should loop infinitely
-- This is printed to stdout

  0 passing (11s)
  1 failing

  1) should loop infinitely:
     In test: Timed out

     Last breadcrumb: Starting test

```


## Breadcrumbs

Tests that time out or fail because of uncaught exceptions can sometimes be very hard to debug, in particular when the test failures are intermittent. In order to help the developer to find out what was going on, Overman provides a simple but powerful feature called *breadcrumbs*:

When a test is run, it leaves breadcrumbs. By default, a breadcrumb is left at the start of the test and at the start of every hook, but a test can choose to leave breadcrumbs at any time. When a test times out or fails because of an uncaught exception, overman reports the last breadcrumb in the error message.

This can make the error messages from a test much more useful. Instead of just saying that the test timed out, the developer will be able to see that the timeout happened in between two breadcrumb traces in the code.

It can be useful to sprinkle some breadcrumbs in tests that do several things that can potentially stall.

One example of how this can be used is in a test suite that has a before hook that first acquires test user credentials and then logs in with them:

```javascript
beforeEach(function logIn() {
  context.breadcrumb('Acquiring test user credentials');
  return acquireTestUserCredentials()
    .then(function(credentials) {
      // When leaving a breadcrumb, Overman will record the current stack
      // trace. This is useful in order to find where the breadcrumb was left
      // and how the code ended up being run.
      context.breadcrumb('Logging in as ' + credentials.username);
      return logIn(credentials);
    });
});
```

If the test times out when it attempts to acquire user credentials, the error message will say that the last breadcrumb was just that. Correspondingly, if the test timed out trying to log in, the error message will clearly state that, along with the test user that was chosen.

Another use case of breadcrumbs is when a test must wait until a certain condition is fulfilled.

```javascript
it('should wait until a condition is fulfilled', function(done) {
  listenForStateUpdates(function(state) {
    try {
      expect(state).to.be.deep.equal(expectedState);
      done();
    } catch (error) {
      // It is possible to pass in Error objects as breadcrumbs. Then the error
      // object's stack trace will be used as the stack trace of the
      // breadcrumb. Be careful when using this feature; it is possible to
      // abuse this and assign incorrect or misleading stack traces to
      // breadcumbs.
      context.breadcrumb(error);
    }
  });
});
```

When the state is never updated to the expected value, the test will time out. Instead of a plain timeout message, Overman will then report the last state validation error, which could shed light on what was going on.


## Syntax errors in tests

When a test file has a syntax error, Overman reports it similarly to `node`s error output when it's instructed to load the file. For example, the following test file

```javascript
// A syntax error
var fs require('fs');
```

causes Overman to print

```
Failed to process test/test_error.js:

/Users/peck/prog/overman/test/test_error.js:2
var fs require('fs');
     ^^^^^^^
SyntaxError: Unexpected identifier
  at Module._compile (module.js:439:25)
  [[ stack trace elided ]]
```


## Test file loading errors

When loading a test file throws an error, Overman reports that as well

```javascript
// Throw an error
var fs = require('nonexistent-module');
```

causes Overman to print

```
Failed to process test/test_error.js:

module.js:340
  throw err;
        ^
Error: Cannot find module 'nonexistent-module'
  at Function.Module._resolveFilename (module.js:338:15)
  [[ stack trace elided ]]
```


## Listing timeout

When loading a test file takes very long time, Overman detects that:

```javascript
// Go on forever
for (;;);
```

causes Overman to print

```
Timed out while listing tests of test/test_error.js
```