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

### error

TODO

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

### breadcrumb

```javascript
{
  "type": "breadcrumb",
  "message": [A string with a message],
  "trace": [A string with a stack trace for the breadcrumb]
}
```

Emitted whenever the test emits a breadcrumb. The purpose of `breadcrumb`
messages is to ease debugging, in particular test failures that show up as
timeouts.

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

TODO

## Helper reporters

TODO
