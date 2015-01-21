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
 * MessageTracker is a very basic reporter (in the sense that it conforms to the
 * reporter interface) that does nothing but keep track of messages of a given type
 * that tests emit.
 *
 * It doesn't actually report anything anywhere but it exposes an accessor for
 * getting the relevant messages that a test has emitted so far.
 *
 * This is useful for example when not immediately showing errors or breadcrumbs for
 * tests.
 */
function MessageTracker(messageType) {
  this._messageType = messageType;
  this._messages = {};  // Hash of JSON'd testPath to array of messages
  this._timedout = {};  // Hash of JSON'd testPath to bool indicating if this run of the test timed out
}
module.exports = MessageTracker;

MessageTracker.prototype.getMessages = function(testPath) {
  var key = testPathToKey(testPath);
  return this._messages[key] || [];
};

MessageTracker.prototype._addMessage = function(testPath, message) {
  var key = testPathToKey(testPath);
  this._messages[key] = this.getMessages(testPath).concat([message]);
};

MessageTracker.prototype._testTimedOut = function(testPath) {
  return !!this._timedout[testPathToKey(testPath)];
};

MessageTracker.prototype.gotMessage = function(testPath, message) {
  if (message.type === this._messageType) {
    if (!this._testTimedOut(testPath)) {
      this._addMessage(testPath, message);
    }
  } else if (message.type === 'timeout') {
    this._timedout[testPathToKey(testPath)] = true;
  } else if (message.type === 'retry') {
    this._messages[testPathToKey(testPath)] = [];
    delete this._timedout[testPathToKey(testPath)];
  }
};
