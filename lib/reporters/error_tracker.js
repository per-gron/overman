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

function testPathToKey(testPath) {
  return JSON.stringify(testPath);
}

/**
 * ErrorTracker is a very basic reporter (in the sense that it conforms to the
 * reporter interface) that does nothing but keep track of errors that tests
 * emit.
 *
 * It doesn't actually report anything anywhere but it exposes an accessor for
 * getting the errors that a test has emitted so far.
 *
 * This is useful when showing errors for tests not immediately when the error
 * occured.
 */
function ErrorTracker() {
  this._errors = {};  // Hash of JSON'd testPath to array of error messages
}
module.exports = ErrorTracker;

ErrorTracker.prototype.getErrors = function(testPath) {
  var key = testPathToKey(testPath);
  return this._errors[key] || [];
};

ErrorTracker.prototype._addError = function(testPath, message) {
  var key = testPathToKey(testPath);
  this._errors[key] = this.getErrors(testPath).concat([message]);
};

ErrorTracker.prototype.gotMessage = function(testPath, message) {
  if (message.type === 'error') {
    this._addError(testPath, message);
  } else if (message.type === 'retry') {
    this._errors[testPathToKey(testPath)] = [];
  }
};
