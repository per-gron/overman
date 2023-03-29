# `TestInterface`

By default tests written for Overman are in a [BDD style that mimicks Mocha's
default interface](bdd_interface.md). However, if you want to run tests written
with a different syntax, this can be done using the Interface API, described in
this document.

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

See [interfaces.ts](../src/interfaces/interface.ts).

## `RuntimeContext`

The runtime context is passed to the test interface and exposes means to
communicate back to the suite runner and reporters.

See [`RuntimeContext`](../src/runtime_context.ts.ts).
