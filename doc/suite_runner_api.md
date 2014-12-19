# The Suite Runner API

This document describes the Javascript API for running tests with Overman. The
API consists of one function. Here's a basic example that runs some tests with
the default spec reporter and uses the default BDD interface:

```javascript
var overman = require('overman');

overman({
  files: ['some.js', 'test.js', 'files.js']
  // More options go here
}).done(function() {
  console.log('Tests completed successfully');
}, function(error) {
  console.error('Tests failed!');
});
```

The suite runner takes a dictionary of options and returns a promise of the
test result. If the promise fails with an `overman.TestFailureError` error, it
means that one or more tests failed. If the promise fails with any other error,
it signifies an internal error in the test runner or a reporter. By default,
information about internal errors are printed to stderr, but this can be
configured with the `internalErrorOutput` option.

## Options

Overman can be configured in a variety of ways by passing options to the suite
runner:

* `files`: Array of paths to suite files to test. *Required*.
* `timeout`: Default test timeout in ms. Defaults to 10000.
* `listingTimeout`: Timeout for listing tests. Defaults to 1000.
* `graceTime`: Time that a test process has to shut down after a timeout (and it
  gets SIGINT) before it is hard killed.
* `slowThreshold`: The time, in ms, a test should take to be considered slow.
  Defaults to 1000.
* `interface`: Path to interface file. Optional, the BDD interface is chosen by
  default.
* `interfaceParameter`: Parameter to the interface. Optional, but some
  interfaces may require it.
* `reporters`: Array of reporter objects. Optional, the spec reporter is chosen
  by default.
* `attempts`: Maximum number of times to run a test; if >1 the test will be
  retried on failure. Defaults to 1.
* `parallelism`: Number of tests to run in parallel. Defaults to 8.
* `match`: Regex or string. Only tests that match the criteria will be run.
* `disallowOnly`: Fail if there are tests marked as only. This may be useful to
  set on CI servers, to catch tests mistakenly checked in as only.
* `internalErrorOutput`: When the suite runner fails with an internal error, it
  writes information about it to this stream. Defaults to stderr

## Cancelling the test runner

The suite runner supports cancellation. This is useful to do for example as a
response to the `SIGINT` signal. Cancellation is done by calling `cancel` on the
promise that is returned from the suite runner function.

Here's an example of how this can be used:

```javascript
var overman = require('overman');

var suitePromise = overman({ files: process.argv.slice(1) });

process.on('SIGINT', function() {
  suitePromise.cancel();
});

suitePromise.done(function() {}, function(err) {
  process.exit(1);
});
```
