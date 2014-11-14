'use strict';

/**
 * Get the path to the suite of the given test or suite.
 */
function suitePathOf(testPath) {
  if (testPath.path.length === 0) {
    return null;
  } else {
    return {
      file: testPath.file,
      path: testPath.path.slice(0, -1)
    };
  }
}
exports.suitePathOf = suitePathOf;
