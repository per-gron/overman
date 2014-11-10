
/**
 * ErrorDetector is a reporter mainly for internal use by the suite
 * runner. It remembers if any of the tests runs failed.
 */
function ErrorDetector(reporters) {
  this._didFail = false;
}

ErrorDetector.prototype.registerTests = function(testPaths) {
};

ErrorDetector.prototype.gotMessage = function(testPath, message) {
  if (message.type === 'finish' && !message.result.match(/^(success)|(skipped)$/)) {
    this._didFail = true;
  }
};

ErrorDetector.prototype.done = function() {
};

ErrorDetector.prototype.didFail = function() {
  return this._didFail;
};

module.exports = ErrorDetector;
