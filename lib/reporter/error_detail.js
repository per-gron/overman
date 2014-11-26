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

var errorMessageUtil = require('../error_message_util');

/**
 * ErrorDetail is a reporter that, when all tests have run, prints the errors
 * that occured. This is typically used together with other reporters for
 * example the SpecProgress reporter and the Summary reporter.
 */
function ErrorDetail(stream) {
  this._stream = stream;
  this._failures = [];  // Array of { test: [testPath], message: [finish message] }
  this._errorTracker = new errorMessageUtil.ErrorTracker();
  this._phaseTracker = new errorMessageUtil.PhaseTracker();
}

ErrorDetail.prototype.gotMessage = function(testPath, message) {
  this._phaseTracker.gotMessage(testPath, message);
  this._errorTracker.gotMessage(testPath, message);

  if (message.type === 'finish' && message.result && !message.result.match(/^(success)|(skipped)$/)) {
    this._failures.push({
      test: testPath,
      message: message
    });
  }
};

ErrorDetail.prototype.done = function() {
  var self = this;

  this._failures.forEach(function(failure, idx) {
    var errorNumber = idx + 1;
    self._stream.write('  ' + errorNumber + ') ' + failure.test.path.join(' ') + ':\n');
    var indentation = errorNumber.toString().length + 4;

    if (failure.message.result === 'timeout') {
      var lastPhase = self._phaseTracker.getLastPhase(failure.test);
      self._stream.write(errorMessageUtil.indent(errorMessageUtil.prettyTimeout(lastPhase), indentation) + '\n');
    }

    self._errorTracker.getErrors(failure.test).forEach(function(error) {
      self._stream.write(errorMessageUtil.indent(errorMessageUtil.prettyError(error), indentation) + '\n');
    });
  });
};

module.exports = ErrorDetail;
