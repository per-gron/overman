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

var Combined = require('./combined').default;

/**
 * Timer is a reporter for internal use by the suite runner. It forwards all
 * messages to another reporter, but also adds "time", "slow" and "halfSlow"
 * fields to finish messages.
 *
 * This is used in the suite runner as a way to move logic out of that file.
 */
function Timer(reporter) {
  this.reporters = [reporter];
  this._reporter = reporter;
  this._defaultSlowThreshold = null; // Is set in registerTests
  this._slowThresholdOverrides = {}; // Hash from test path JSON to overriden slow threshold
  this._testStartTimes = {}; // Hash from test path JSON to test start times
  this._testDoneTimes = {}; // Hash from test path JSON to test done times
}
Timer.prototype = Object.create(Combined.prototype);

Timer.prototype._getSlowThresholdForTest = function (key) {
  return key in this._slowThresholdOverrides
    ? this._slowThresholdOverrides[key]
    : this._defaultSlowThreshold;
};

Timer.prototype._setSlowThresholdForTest = function (key, value) {
  this._slowThresholdOverrides[key] = value;
};

Timer.prototype.registerTests = function (tests, options) {
  Combined.prototype.registerTests.apply(this, arguments);
  this._defaultSlowThreshold = options.slowThreshold;
};

Timer.prototype.gotMessage = function (testPath, message, time) {
  var key = JSON.stringify(testPath);
  if (message.type === 'startedTest') {
    this._testStartTimes[key] = time.getTime();
  } else if (message.type === 'startedAfterHooks') {
    this._testDoneTimes[key] = time.getTime();
  } else if (message.type === 'setSlowThreshold') {
    this._setSlowThresholdForTest(key, message.value);
  } else if (message.type === 'finish') {
    if (key in this._testDoneTimes && key in this._testStartTimes) {
      var duration = this._testDoneTimes[key] - this._testStartTimes[key];
      message.duration = duration;

      var slowThreshold = this._getSlowThresholdForTest(key);
      message.halfSlow = duration >= slowThreshold / 2;
      message.slow = duration >= slowThreshold;
    }
  }

  Combined.prototype.gotMessage.apply(this, arguments);
};

module.exports = Timer;
