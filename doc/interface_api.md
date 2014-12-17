# The Interface API

By default tests written for Overman are in a [BDD style that mimicks Mocha's
default interface](bdd_interface.md). It is possible to configure the syntax for
Overman tests: This is done with the Interface API, described in this document.

An Overman Interface is a node.js module that exports a function. This function
is invoked whenever Overman needs to list the tests of a test suite, both for
listing purposes and to get the actual functions that execute tests.

The interface is invoked several times per suite run: Once for every test suite
file to list the tests, and once for every test. Because of this, it is
important that the interface always reports the same thing when it asked over
and over again.

Unlike reporters, which are run in the main suite runner process, interfaces are
always run in sub-processes. This means that interfaces don't share memory with
reporters, so all communication must go through serialized channels. It also
means that uncaught exceptions in interfaces are gracefully caught and reported.

Because interfaces are run in a separate process, they can't be provided as an
object to the suite runner. Instead, the interface's path is provided.

## A skeleton Interface

```javascript
'use strict';

/**
 * This function is the entry point for the interface.
 *
 * @param parameter String. Parameter to the interface, as provided by the user.
 *     May be '' or undefined if not set. Many interfaces will not use this at
 *     all, but for some use cases it really comes in handy.
 * @param file Path to the suite file that should be parsed. May be absolute or
 *     relative to the cwd.
 * @param runtimeContext The runtime context, for communication with the suite
 *     runner and reporters. This parameter is undefined when Overman is only
 *     listing tests and doesn't intend to actually run them. See below for more
 *     details.
 *
 * @return A suite descriptor object, see below for more details.
 */
module.exports = function(parameter, file, runtimeContext) {
  // Typically this function will require() the suite file at some point
  return {
    type: 'suite',
    contents: []
  };
};
```

## Suite descriptor objects

A suite descriptor object is a Javascript object that describes a test suite. It
will often contain Javascript functions and is thus not directly serializable to
JSON.

The format is this:

```javascript
{
  "type": "suite",
  "contents": [Array of suites and test descriptor objects],
  ["name": [String]],
  ["only": [boolean]],
  ["skipped": [boolean]],
  ["before": [Array of { "run": [Function], ["name": [String]] }]],
  ["after": [Array of { "run": [Function], ["name": [String]] }]]
}
```

`name` must not be present for the top level suite, but it must be present for
all sub suites.

When `only` is true, only that test or suite and other tests and suites marked
as only are run.

When `skipped` is true, that test or suite will be skipped.

The functions specified in the `before` and `after` properties are considered
before and after hooks. Hooks can optionally have names. The hook functions may
be synchronous or asynchronous (by taking a `done` callback or by returning a
promise).

The format of a test descriptor object is similar:

```javascript
{
  "type": "test",
  "name": [String],
  ["only": [boolean]],
  ["skipped": [boolean]],
  ["run": [Function]]
}
```

The `name` field is always required for tests. It is an error to have two tests
in the same suite that have the same name.

The `only` and `skipped` properties have the same semantics as they have for
suites.

The `run` function is required if the test is not skipped. Like the hook
functions, it may be synchronous or asynchronous (by taking a `done` callback or
by returning a promise).

## The runtime context

The runtime context is passed to the test interface and exposes means to
communicate back to the suite runner and reporters. It exposes some functions:

### `getTimeout`/`setTimeout`

```javascript
var currentTimeout = runtimeContext.getTimeout();
runtimeContext.setTimeout(1234);
```

Gets and sets the timeout for the current test.

### `getSlowThreshold`/`setSlowThreshold`

```javascript
var currentSlowThreshold = runtimeContext.getSlowThreshold();
runtimeContext.setSlowThreshold(1234);
```

Gets and sets the slow threshold for the current test. If the test takes longer
time to run than the slow threshold, it is considered slow, and reporters may
mark them in a special way.

### `leaveBreadcrumb`

```javascript
// Extract a stack trace
var trace = (new Error()).stack.split(/\n/).splice(2).join('\n');
runtimeContext.leaveBreadcrumb('A breadcrumb', trace);
```

Leaves a breadcrumb. Reporters may use breadcrumbs to provide nicer error
reporting, in particular when tests time out.

### `emitDebugInfo`

```javascript
runtimeContext.emitDebugInfo('name', { a: 'value' });
```

Emits debug info. Reporters may use debug info in various ways. Overman does not
use debug info messages; it merely provides them as a means of communicating
between tests and custom interfaces and custom reporters.
