# Overman

![Node.js CI](https://github.com/per-gron/overman/workflows/Node.js%20CI/badge.svg)

Mocha inspired test framework for integration and system tests.

## Changelog

### 1.x

- Suite runner function is now exported as `default` from package main.
- Other exported symbols are exported separately.

```diff
- import overman = require('overman');
- new overman.reporters.Summary(process.stdout);

+ import overman, { reporters } from 'overman';
+ new reporters.Summary(process.stdout);
```

- `Options.timeoutTimer` is replaced by `Options.timerFactory`

```diff
- suiteRunner({ timeoutTimer: MyTimerClass });
+ suiteRunner({ timerFactory: (timeout) => new MyTimerClass(timeout) });
```

- Suite runner (module default export) now returns a pure Promise. Cancellation is done by providing a `signal: AbortSignal` in `Options`.
