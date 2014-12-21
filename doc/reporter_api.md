# The Reporter API

The reporter API is the specification for interaction between the suite runner
and the things that actually emits machine or human readable test result output.
The suite runner is invoked with zero or more `Reporter` objects. This documents
describes how `Reporter` objects should behave.

An Overman `Reporter` is a Javascript object that lives in the suite runner
process. This means that reporters don't share memory with tests, and an
uncaught exception in a reporter will cause the entire test run to fail.

## The `Reporter` object

There are four methods that are invoked on reporters: `registrationFailed`,
`registerTests`, `gotMessage` and `done`. They are all optional; the minimal
valid Overman reporter is `{}`.

Here is a skeleton implementation of a `Reporter` that implements all methods of
the interface:

```javascript
function SkeletonReporter() {
}

/**
 * The first thing that Overman does when running tests is to evaluate the test
 * files to extract the list of tests to be run. If that process fails, for
 * example because there is a syntax error or the test attempts to require a
 * nonexistent module, this method is called.
 *
 * If it is called, it is called only once, and none of the other reporter
 * methods are invoked.
 *
 * @param error An Error object with information about what went wrong.
 * @param time A Date object that represents the time that the call was made.
 *     When at all possible, it is preferable to use these time stamps over
 *     using real wall time, since it enables other reporters to do things like
 *     replaying events and other nice things.
 */
SkeletonReporter.prototype.registrationFailed = function(error, time) {
};

/**
 * This method is invoked exactly once and is always the first method to be
 * called. (The exception is when registrationFailed is invoked; then this
 * method will not be called.)
 *
 * This method is called with a list of all tests that the suite runner intends
 * to report results for (this includes tests that will be skipped). Please note
 * that the suite runner may be aborted while it's working (for example by the
 * user pressing Ctrl-C) and in such cases the test run will end early and the
 * reporter may not receive messages for remaining tests.
 *
 * If a reporter needs to be able to know about the suites in advance of the
 * tests being run, this is where that information can be inferred: Iterate
 * through the test paths and see which suites are present.
 *
 * @param tests An array of test paths (see below for information of what these
 *     objects contain).
 * @param time A Date object that represents the time that the call was made.
 *     When at all possible, it is preferable to use these time stamps over
 *     using real wall time, since it enables other reporters to do things like
 *     replaying events and other nice things.
 */
SkeletonReporter.prototype.registerTests = function(tests, time) {
};

/**
 * This is where the bulk of most reporters' work happen. gotMessage will be
 * called zero or more times, always after registerTests and before done.
 *
 * The execution of each test results in several messages. The format of the
 * messages are described in a section below.
 *
 * The messages from a given test will always be sent in sequence. Tests may
 * however be run in parallel. When they are, messages for different tests will
 * be interleaved. For example, when executing two tests A and B, each test
 * emitting A1, A2, A3, B1, B2 and B3, respectively, the messages may be emitted
 * in any of these ways (and lots of other ways):
 *
 * * A1, A2, A3, B1, B2, B3
 * * B1, B2, A1, A2, B3, A3
 * * B1, A1, B2, A2, B3, A3
 *
 * For some reporters this is not a problem at all (for example reporters that
 * simply detect errors and do something with the errors at the end). Other
 * reporters need this information in order to get to know test results as soon
 * as possible (for example the spec reporter).
 *
 * For some reporters, the interleaved nature of test messages make things very
 * tricky (for example the TeamCity reporter that emits test results to a flat
 * stream). For this use case, there is a helper reporter Serializer that will
 * delay certain messages so that test messages and suites are not interleaved.
 *
 * @param testPath A test path object that identifies the test that this message
 *     is about.
 * @param message The message. For more information about what this will
 *     contain, see below.
 * @param time A Date object that represents the time that the call was made.
 *     When at all possible, it is preferable to use these time stamps over
 *     using real wall time, since it enables other reporters to do things like
 *     replaying events and other nice things.
 */
SkeletonReporter.prototype.gotMessage = function(testPath, message, time) {
};

/**
 * This method is invoked exactly once and is always the last method to be
 * called. (The exception is when registrationFailed is invoked; then this
 * method will not be called.) Here it is appropriate to do things like
 * emitting a test result summary.
 *
 * Please note that it is not possible to induce when tests have finished
 * running by looking at the tests passed to registerTests and waiting for all
 * tests to finish, because if the test run is aborted (for example by the user
 * pressing Ctrl-C on the suite runner), not all tests will be run.
 *
 * @param time A Date object that represents the time that the call was made.
 *     When at all possible, it is preferable to use these time stamps over
 *     using real wall time, since it enables other reporters to do things like
 *     replaying events and other nice things.
 */
SkeletonReporter.prototype.done = function(time) {
};

```

## Test paths

A test path is a plain Javascript object that represents a single test. It has
the form

```javascript
{
  "file": "[path to the test file, can be absolute or relative to the cwd",
  "path": ["suite", "subsuite", "testname"]
}
```

The `path` field is an array that has at least one element (this happens when
the test is in the top level of a test file).


## Reporter messages

For most reporters, the bulk of the logic resides in how it handles the test
messages. There are a few:

### start

```javascript
{
  "type": "start",
  ["skipped": [boolean]]
}
```

The test will begin momentarily. This message is emitted exactly once per test,
and is always the first message for a given test run. `skipped` will be `true`
if the test is going to be skipped.

### stdio

```javascript
{
  "type": "stdio",
  "stdin": [Stream],
  "stdout": [Stream],
  "stderr": [Stream]
}
```

The test process has started and the streams of the test process are handed to
reporters. This message is emitted once, directly after the "start" message.
When the test is skipped this message is not emitted.

### startedBeforeHooks

```javascript
{
  "type": "startedBeforeHooks"
}
```

The test is now about to run the before hooks. This message is emitted even when
there are no before hooks. When the test is skipped this message is not emitted.

### startedBeforeHook

```javascript
{
  "type": "startedBeforeHook",
  "name": [name]
}
```

A before hook is now running. This message is emitted once per before hook. When
the test is skipped this message is not emitted.

### startedTest

```javascript
{
  "type": "startedTest"
}
```

The before hooks have successfully completed, and the actual test has started.
This message is emitted at most once per test. It is not emitted for skipped
tests, when a before hook failed or when the test timed out before the before
hooks finished.

### startedAfterHooks

```javascript
{
  "type": "startedAfterHooks"
}
```

Emitted when the test has finished running (successfully or not) or after a
before hook has failed. It means that the test runner is about to execute the
after hooks. This message is emitted even when there are not after hooks. This
message is *not* emitted when the test timed out before this stage.

### finish

```javascript
{
  "type": "finish",
  "result": ["skipped"|"failure"|"success"|"timeout"|"aborted"],
  ["code": [exit code number]],
  ["signal": [exit signal, eg "SIGKILL"]]
}
```

Emitted when the test has finished running. This message is emitted exactly once
per test, and is always the last message for a given test.

The `result` field is the canonical result of the test. If `result` is
`"failure"`, the test counts as failed, even if no errors were emitted (this
does not normally happen, but it could in the case of a crash). A test should
only be considered successful if `result` is `"success"`. Skipped tests have
`result` `"skipped"`, test that time out have `"timeout"`. Tests that ran while
the suite runner was cancelled will be reported with a `result` of `"aborted"`.

If the `result` is `"success"` or `"failure"`, the `code` and possibly the
`signal` fields will be present. `code` has the exit code of the test process,
`signal` has node's string representation of a signal that terminated the
process, for example `"SIGKILL"`.

### retry

When Overman is configured to attempt to run a test more than once if it fails
at first, and the test fails, a `retry` message is emitted instead of a `finish`
message when the test fails and it will be attempted again. The format of
`retry` messages is identical to that of `finish` messages, except that the
result field of a `retry` message can never be `"success"`.

No new `start` message is emitted after a `retry` message, it is implied that
the test has started. Other than that, the new test run will emit messages as if
it was the first one.

### error

```javascript
{
  "type": "error",
  "stack": [string with error message and trace],
  "in": ["beforeHook", "test", "afterHook", "uncaught"],
  ["inName": [name of the hook where the error occured]]
}
```

Whenever an error occurs in the test, an `error` message is emitted. Several
`error` messages can be emitted for each test run, for example if both the test
itself and an after hook fails.

The `stack` field contains the bulk of the information about the error. It
typically is the `trace` property of the error object.

The `in` field is always present and contains information about where the error
occured. If an uncaught exception is thrown, `in` is `"uncaught"`.

If the error occurs in a named before or after hook, its name is in the `inName`
field.

### breadcrumb

```javascript
{
  "type": "breadcrumb",
  "message": [A string with a message],
  "trace": [A string with a stack trace for the breadcrumb],
  ["systemGenerated": [boolean]]
}
```

Emitted whenever the test emits a breadcrumb. The purpose of `breadcrumb`
messages is to ease debugging, in particular test failures that show up as
timeouts.

Overman itself generates breadcrumbs for each main phase of the test: One for
every hook and one for the test. These breadcrumb messages are marked with
`systemGenerated` set to `true`.

### debugInfo

```javascript
{
  "type": "debugInfo",
  "name": [A string],
  "value": [A JSON object]
}
```

Emitted whenever the test emits debug info. The purpose of `debugInfo` messages
is to add a channel for tests to feed free-form data to reporters, for example
metadata about latencies, user names, log files etc. Neither Overman itself nor
any of the built in reporters do anything with these messages except passing
them on.


## Writing a custom reporter

Hopefully, this document has enough information to get you started with writing
reporters. A good starting point could be to copy-paste `SeletonReporter` from
above and strip away the doc comments and remove the callbacks you don't care
about and get going.

Here are some things that are good to think about when writing reporters:

### The `retry` message

Overman supports retrying tests if they fail at first. This feature can be very
useful as a tool deal with unstable tests and still get useful information out
of them. It also makes writing reporters more complicated.

Some reporters don't have to care about the potential retries at all, but some
will have to do something about it. The most common case where special handling
of retries is necessary is when a reporter keeps track of things that happened
during a test run to be able to report it later, for example errors. Such a
reporter must make sure to handle `retry` messages correctly, so that it doesn't
report errors from previous test runs as if they happened during the last one.

### Use the built-in reporter helpers

There are several reporters in Overman that you can use when writing your own.
They are described in the "Helper reporters" section below. I strongly recommend
reading that section; it could save you a lot of time. For example there are
helpers for running several reporters in parallel, printing different kinds
of test result summaries, piping output to stdout or other streams, timing
tests, dealing with Overman's parallelism and getting explicit suite
information.

### Avoid complexity

Unless you're careful, reporters have a tendency to amass rather complex state.
Before you know it, the reporter is really hard to reason about. The most
effective way to counter this is to split reporter functionality into smaller
parts.

For example, it often makes sense to separate test progress reporting
from reporting a summary at the end. You may be able to split those parts and
have one reporter for each task and combine them with the `Combined` reporter.

In more complex cases, it may be possible to split functionality by "piping"
reporters: Have one reporter that simply forwards all messages but adds some
kind of metadata to the messages. This technique is used for example in the
`Timer` reporter, and in a more sophisticated way in `Serializer` and
`SuiteMarker`. A convenient way to implement this pattern is to "inherit" the
`Combined` reporter. For an example of how to do this, look at
`suite_marker.js`.

## Helper reporters

The implementation of Overman makes heavy use of the Reporter API as a means of
modularizing code. There are several reporters that aren't useful by themselves,
but are rather designed to help other reporters to do their work.

### Combined

```javascript
var overman = require('overman');
new overman.reporters.Combined([reporter1, reporter2, reporter3]);
```

It is often useful to run more than one reporter in parallel. For example, one
reporter may be responsible for printing the progress of a test suite while
another reporter prints a summary at the end of the test run. Or there could be
reporters that operate completely in parallel, for example one writing to the
console and another that logs the test result to a server somewhere.

`Combined` helps with this by passing on all reporter calls to each of the
reporters that are passed to it when it is constructed. The messages are sent
to the reporters in the order they are given.

### Summary

```javascript
var overman = require('overman');
new overman.reporters.Summary(process.stdout);
```

`Summary` prints out a basic summary that counts how many tests that passed,
failed, were skipped, timed out and were aborted. For more complete error
information, `ErrorDetail` and `Summary` are often used together (`Summary` is
usually first).


### ErrorDetail

```javascript
var overman = require('overman');
new overman.reporters.ErrorDetail(process.stdout);
```

In many cases, a console based reporter doesn't care about how to format the
error report at the end of a test run. For example, a dot reporter, a spec
reporter and a nyancat reporter may all print errors in the same way once the
suite is finished.

`ErrorDetail` does this. It does *not*, however, print a summary that states how
many tests succeeded, how many tests failed and so on. For that, use `Summary`.
`ErrorDetail` and `Summary` are often used together (`Summary` is usually
first).

### ErrorDetector

```javascript
var overman = require('overman');
var detector = new overman.reporters.ErrorDetector();
// ...
console.log(detector.didFail());
```

`ErrorDetector` is a very simple reporter. It keeps track of whether any
non-skipped tests finished with a non-`"success"` state. If so, its `didFail`
method returns `true`.

### Pipe

```javascript
var overman = require('overman');
new overman.reporters.Pipe({ stdout: process.stdout, stderr: process.stderr });
```

By default, Overman swallows all test output. It is often useful to actually
print what tests print. The `Pipe` reporter takes streams and pipes the test
streams to those streams.

### Serializer

```javascript
var overman = require('overman');
new overman.reporters.Serializer(innerReporter);
```

Because of the parallel nature of Overman, messages for tests may be emitted in
an interleaved fashion. For some reporters, for example a reporter that counts
the number of errors or a reporter that merely prints the name of a test when it
has finished, this interleaving doesn't matter. Other reporters, for example an
advanced HTML-based reporter, might actively use the extra information that this
interleaved ordering provides (in particular, it is good because results can be
communicated to the user without any delay).

In other cases, for example a reporter that prints test results in suite order,
this is a major issue. In those cases the `Serializer` reporter is really handy:
It receives messages from tests and delays some of them before passing them
along to its inner reporter to give the illusion that tests are executed
serially.

`Serializer` provides the following guarantees:

* **Only one test at a time**: The `Serializer` reporter will not emit a `start`
  message if it has emitted a `start` message that hasn't been closed with a
  matching `finish` message.
* **Only one suite at a time**: `Serializer` will ensure that once a test in a
  given suite has started, all tests within that suite will be reported as
  finished before any test in adjacent or ancestor suites are reported. Tests
  in subsuites may be reported though.

In my experience, `Serializer` is often used together with `SuiteMarker`.

### SuiteMarker

```javascript
var overman = require('overman');
new overman.reporters.SuiteMarker(innerReporter);
```

The raw reporter API doesn't provide explicit information about when suites are
started and finished. For many reporters this doesn't matter, but for some, the
lack of explicit suite information is quite a nuisance. In these cases,
`SuiteMarker` comes in handy.

`SuiteMarker` forwards all the messages without modification, but it also adds
two extra messages (they are sent with `null` test paths):

```javascript
{
  "type": "suiteStart",
  "suite": [suite path]
}
```

and

```javascript
{
  "type": "suiteFinish",
  "suite": [suite path]
}
```

where `[suite path]` is an object with the same format as a test path, except
that the path refers to a suite rather than a test, for example
`{ "file": "file", "path": ["suite", "subsuite"] }`.

Over a complete test run, one `suiteStart` message and one `suiteFinish` message
will be emitted for every suite. The exception is suites that don't have any
tests, they are ignored.

`suiteStart` messages are emitted right before the first test in a given suite
is started. `suiteFinish` messages are emitted right after the last test in a
given suite finished. A `suiteStarted` message for an ancestor suite is always
emitted *before* `suiteStarted` messages for its descendants. `suiteFinish`
messages for ancestor suites are always emitted *after* `suiteFinish` messages
of its descendants.

For example, consider a test file that has tests `suite1/a`, `suite2/b`
and `suite2/subsuite/c` (where `/` indicates the suite hierarchy). Messages
may be emitted in this order:

* `suiteStart` for `suite1`
* `start` for `suite1/a`
* `suiteStart` for `suite2`
* `suiteStart` for `suite2/subsuite`
* `start` for `suite2/subsuite/c`
* `finish` for `suite1/a`
* `suiteFinish` for `suite1`
* `finish` for `suite2/subsuite/c`
* `suiteFinish` for `suite2/subsuite`
* `start` for `suite2/b`
* `finish` for `suite2/b`
* `suiteFinish` for `suite2`

`SuiteMarker` will also emit `suiteStart` and `suiteFinish` messages for top
level suites, for example `{ "file": "file", "path": [] }`. This may not be
interesting information to all reporters, so some may choose to filter out
messages with an empty path array.

Keep in mind that `SuiteMarker` in itself does not provide any extra ordering
guarantees over the quite interleaved raw reporter messages. This means that
you can get interleaved `suiteStart` and `suiteFinish` messages. For example,
it is quite likely that a `suiteStart` for an adjacent test suite will be
emitted before `suiteFinish` is emitted for one that is running.

In some cases, the interleaved ordering is fine, but in many cases you will want
to use the `Serializer` reporter together with `SuiteMarker` in order to get
strict ordering guarantees.

When used together with `Serializer`, `SuiteMarker` must be within the
`Serializer` and not the other way around. `Serializer` requires test paths
for all messages, but the extra `SuiteMarker` messages don't have that.

```javascript
var overman = require('overman');
// Do this, not the other way around:
new overman.reportersSerializer(new overman.reporters.SuiteMarker(innerReporter));
```

### Timer

```javascript
var overman = require('overman');
new overman.reporters.Timer(innerReporter);
```

When writing reporters, it is often useful to report how quick a test was to
run. The `Timer` reporter helps with this by adding extra timing information
to `finish` messages. It adds three extra fields:

* `duration`: Time in milliseconds for how long the test took to run.
* `slow`: Boolean. `true` if the test duration was at least the slow threshold
  (as specified by a suite runner global configuration parameter or as
  overridden by the specific test). The spec reporter uses this to know when to
  show the duration with red color.
* `halfSlow`: Boolean. `true` if the test duration was at least half the slow
  threshold. The spec reporter uses this to know when to show the duration with
  yellow color.

The time that is measured by `Timer` is the time that the test itself took to
run; before and after hooks are not counted.

### MessageTracker

```javascript
var overman = require('overman');
var tracker = new overman.MessageTracker('error');
// Run tests
var messages = tracker.getMessages();
```

It is sometimes useful to store away all tests of a particular type, for example
all `error` or `breadcrumb` messages. `MessageTracker` is a simple reporter that
does that for you. It also has logic for resetting its messages when it
encounters a `retry` message.
