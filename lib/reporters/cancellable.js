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

var _ = require('lodash');

/**
 * Cancellable is a reporter mainly for internal use by the suite runner. It
 * forwards all messages to another reporter, except for when it's been
 * "cancelled". When the Cancellable is cancelled, it will emit "aborted" finish
 * messages for all currently running tests and then ignore all subsequent
 * messages.
 *
 * This is used in the suite runner to be able to implement cancellation in a
 * nice way that doesn't require everything to know about cancellation.
 */
function Cancellable(reporter) {
  this._cancelled = false;
  this._reporter = reporter;
  this._registerTestsCalled = false;
  this._outstandingTests = {};  // Map from JSON'd test path to true (a set)
}

Cancellable.prototype._forwardCall = function(message, args) {
  if (!this._cancelled && this._reporter[message]) {
    this._reporter[message].apply(this._reporter, args);
  }
};

['registrationFailed', 'done'].forEach(function(message) {
  Cancellable.prototype[message] = function() {
    this._forwardCall(message, arguments);
  };
});

Cancellable.prototype.registerTests = function() {
  this._registerTestsCalled = true;
  this._forwardCall('registerTests', arguments);
};

Cancellable.prototype.gotMessage = function(testPath, message) {
  var key = JSON.stringify(testPath);
  if (message.type === 'start') {
    this._outstandingTests[key] = true;
  } else if (message.type === 'finish') {
    delete this._outstandingTests[key];
  }

  this._forwardCall('gotMessage', [testPath, message]);
};

Cancellable.prototype.cancel = function() {
  var self = this;

  this._cancelled = true;

  if (this._reporter.gotMessage) {
    _.keys(this._outstandingTests).forEach(function(key) {
      var testPath = JSON.parse(key);
      self._reporter.gotMessage(testPath, { type: 'finish', result: 'aborted' });
    });
  }

  if (this._registerTestsCalled && this._reporter.done) {
    this._reporter.done();
  }
};

module.exports = Cancellable;
