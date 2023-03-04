/*
 * Copyright 2014 Per Eckerdal
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

'use strict';

var chalk = require('chalk');
var prettyDuration = require('../pretty_duration');

var colors = {
  success: chalk.green,
  failure: chalk.red,
  skipped: chalk.cyan,
  aborted: chalk.yellow,
  time: chalk.grey,
};

/**
 * Summary is a reporter that monitors the results of the tests and when all the
 * tests have run, it prints out a summary that counts the number of tests that
 * passed, failed or timed out.
 *
 * @param stream The stream to print to.
 */
function Summary(stream) {
  this._stream = stream;
  this._startedAt = null; // Timestamp in ms when the tests started running
  this._results = {}; // Map from result string (ie 'skipped') to number of tests
}

Summary.prototype.registerTests = function (test, options, time) {
  this._startedAt = time;
};

Summary.prototype.gotMessage = function (testPath, message) {
  if (message.type === 'finish') {
    var oldValue = this._results[message.result];
    this._results[message.result] = oldValue ? oldValue + 1 : 1;
  }
};

Summary.prototype.done = function (time) {
  var timeSinceStart = time.getTime() - this._startedAt.getTime();

  this._stream.write('\n  ' + colors.success((this._results.success || 0) + ' passing'));
  this._stream.write(' ' + colors.time('(' + prettyDuration(timeSinceStart) + ')') + '\n');

  var skipped = this._results.skipped;
  if (skipped) {
    this._stream.write('  ' + colors.skipped(skipped + ' skipped') + '\n');
  }
  var failure = (this._results.failure || 0) + (this._results.timeout || 0);
  if (failure) {
    this._stream.write('  ' + colors.failure(failure + ' failing') + '\n');
  }
  var aborted = this._results.aborted;
  if (aborted) {
    this._stream.write('  ' + colors.aborted(aborted + ' aborted') + '\n');
  }
  this._stream.write('\n');
};

module.exports = Summary;
