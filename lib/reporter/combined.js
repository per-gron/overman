'use strict';

/**
 * Combined is a reporter mainly for internal use by the suite
 * runner. It forwards all messages to other reporters.
 */
function Combined(reporters) {
  this._reporters = reporters;
}

Combined.prototype.registerTests = function(testPaths) {
  this._reporters.forEach(function(reporter) {
    if (reporter.registerTests) {
      reporter.registerTests(testPaths);
    }
  });
};

Combined.prototype.gotMessage = function(testPath, message) {
  this._reporters.forEach(function(reporter) {
    reporter.gotMessage(testPath, message);
  });
};

Combined.prototype.done = function() {
  this._reporters.forEach(function(reporter) {
    if (reporter.done) {
      reporter.done();
    }
  })
};

module.exports = Combined;
