'use strict';

var chalk = require('chalk');
var prettyDuration = require('../pretty_duration');

var colors = {
  success: chalk.green,
  failure: chalk.red,
  skipped: chalk.cyan,
  time: chalk.grey
}

/**
 * Summary is a reporter that monitors the results of the tests and when all the
 * tests have run, it prints out a summary that counts the number of tests that
 * passed, failed or timed out.
 *
 * @param stream The stream to print to.
 * @param getTime Optional. Function that returns the current time in
 *     milliseconds since an arbitrary but constant point in the past. Mainly
 *     used for testing.
 */
function Summary(stream, getTime) {
  this._stream = stream;
  this._getTime = getTime || function() { return (new Date).getTime() };
  this._startedAt = null;  // Timestamp in ms when the tests started running
  this._results = {};  // Map from result string (ie 'skipped') to number of tests
}

Summary.prototype.registerTests = function(testPaths) {
  this._startedAt = this._getTime();
};

Summary.prototype.gotMessage = function(testPath, message) {
  if (message.type === 'finish') {
    var oldValue = this._results[message.result];
    this._results[message.result] = oldValue ? oldValue + 1 : 1;
  }
};

Summary.prototype._timeSinceStart = function() {
  return this._getTime() - this._startedAt;
};

Summary.prototype.done = function() {
  this._stream.write('\n  ' + colors.success((this._results.success || 0) + ' passing'));
  this._stream.write(' ' + colors.time('(' + prettyDuration(this._timeSinceStart()) + ')') + '\n');

  var skipped = this._results.skipped;
  if (skipped) {
    this._stream.write('  ' + colors.skipped(skipped + ' skipped') + '\n');
  }
  var failure = this._results.failure;
  if (failure) {
    this._stream.write('  ' + colors.failure(failure + ' failing') + '\n');
  }
  this._stream.write('\n');
};

module.exports = Summary;
