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
