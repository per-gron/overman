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

/**
 * PhaseTracker is a very basic reporter (in the sense that it conforms to the
 * reporter interface) that does nothing but keep track of where a test was
 * last (ie which hook it was in or if it was in the test).
 *
 * It doesn't actually report anything anywhere but it exposes an accessor for
 * getting the last phase of a test.
 *
 * This is useful when showing error messages for tests that time out: It is
 * helpful to say what timed out.
 */
function PhaseTracker() {
  this._lastPhase = {}; // Hash of JSON'd testPath to { in: '', inName: '' }
  this._timedOut = {}; // Hash of JSON'd testPath to true, if the test has timed out
}
module.exports = PhaseTracker;

PhaseTracker.prototype.gotMessage = function (testPath, message) {
  var key = JSON.stringify(testPath);

  if (message.type === 'retry') {
    delete this._lastPhase[key];
    delete this._timedOut[key];
  } else if (message.type === 'timeout') {
    this._timedOut[key] = true;
  } else if (this._timedOut[key]) {
    // Do nothing; if the test timed out, we don't want to store any more.
    // Otherwise we will always report that the test timed out in after
    // hooks, even though that might not be the case.
  } else if (message.type === 'startedBeforeHook') {
    this._lastPhase[key] = { in: 'beforeHook', inName: message.name };
  } else if (message.type === 'startedTest') {
    this._lastPhase[key] = { in: 'test' };
  } else if (message.type === 'startedAfterHook') {
    this._lastPhase[key] = { in: 'afterHook', inName: message.name };
  }
};

PhaseTracker.prototype.getLastPhase = function (path) {
  return this._lastPhase[JSON.stringify(path)];
};
