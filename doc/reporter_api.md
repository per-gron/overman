# `Reporter`

The reporter API is the specification for interaction between the suite runner
and the things that actually emits machine or human readable test result output.
The suite runner is invoked with zero or more `Reporter` objects. This documents
describes how `Reporter` objects should behave.

An Overman `Reporter` is a Javascript object that lives in the suite runner
process. This means that reporters don't share memory with tests, and an
uncaught exception in a reporter will cause the entire test run to fail.

## `Reporter`

See [`Reporter`](../src/reporters/reporter.ts) and [Messages](../src/reporters/message.ts.ts)

## Writing a custom reporter

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
import { reporters } from 'overman';
new reporters.Combined([reporter1, reporter2, reporter3]);
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
import { reporters } from 'overman';
new reporters.Summary(process.stdout);
```

`Summary` prints out a basic summary that counts how many tests that passed,
failed, were skipped, timed out and were aborted. For more complete error
information, `ErrorDetail` and `Summary` are often used together (`Summary` is
usually first).


### ErrorDetail

```javascript
import { reporters } from 'overman';
new reporters.ErrorDetail(process.stdout);
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
import { reporters } from 'overman';
const detector = new reporters.ErrorDetector();
// ...
console.log(detector.didFail());
```

`ErrorDetector` is a very simple reporter. It keeps track of whether any
non-skipped tests finished with a non-`"success"` state. If so, its `didFail`
method returns `true`.

### Serializer

```javascript
import { reporters } from 'overman';
new reporters.Serializer(innerReporter);
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
import { reporters } from 'overman';
new reporters.SuiteMarker(innerReporter);
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
import { reporters } from 'overman';
// Do this, not the other way around:
new reporters.Serializer(new reporters.SuiteMarker(innerReporter));
```

### Timer

```javascript
import { reporters } from 'overman';
new reporters.Timer(innerReporter);
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
import { reporters } from 'overman';
const tracker = new reporters.MessageTracker('error');
// Run tests
const messages = tracker.getMessages(testPath);
```

It is sometimes useful to store away all tests of a particular type, for example
all `error` or `breadcrumb` messages. `MessageTracker` is a simple reporter that
does that for you. It also has logic for resetting its messages when it
encounters a `retry` message and suppressing messages after tests time out.
