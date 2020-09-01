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
var errorMessageUtil = require('../error_message_util');
var MessageTracker = require('./message_tracker');
var PhaseTracker = require('./phase_tracker');

/**
 * ErrorDetail is a reporter that, when all tests have run, prints the errors
 * that occured. This is typically used together with other reporters for
 * example the SpecProgress reporter and the Summary reporter.
 */
function ErrorDetail(stream) {
  this._stream = stream;
  this._failures = [];  // Array of { test: [testPath], message: [finish message] }
  this._errorTracker = new MessageTracker('error');
  this._breadcrumbTracker = new MessageTracker('breadcrumb');
  this._phaseTracker = new PhaseTracker();
}

ErrorDetail.prototype.registrationFailed = function(error) {
  this._stream.write(errorMessageUtil.prettyError(error));
};

ErrorDetail.prototype.gotMessage = function(testPath, message) {
  this._phaseTracker.gotMessage(testPath, message);
  this._errorTracker.gotMessage(testPath, message);
  this._breadcrumbTracker.gotMessage(testPath, message);

  if (message.type === 'finish' && message.result && !message.result.match(/^(success)|(skipped)|(aborted)$/)) {
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

    var errors = self._errorTracker.getMessages(failure.test);
    errors.forEach(function(error) {
      self._stream.write(errorMessageUtil.indent(errorMessageUtil.prettyError(error), indentation) + '\n');
    });

    if (failure.message.result === 'timeout') {
      var lastPhase = self._phaseTracker.getLastPhase(failure.test);
      self._stream.write(errorMessageUtil.indent(errorMessageUtil.prettyTimeout(lastPhase), indentation));
      self._stream.write('\n');
    }

    // Only show breadcrumbs for tests that time out or that fail with an
    // uncaught exception. This is done because timeouts and uncaught exceptions
    // are always the last thing to happen in a test. "Normal" errors will still
    // make after hooks and so on to run, and in that case it's quite confusing
    // to show the last breadcrumb of a test. That breadcrumb is likely
    // something that happened *after* the error that caused the test to fail.
    var shouldShowBreadcrumb = (
      failure.message.result === 'timeout' ||
      errors.length !== 0 && _.last(errors).in === 'uncaught');

    var breadcrumb = _.last(self._breadcrumbTracker.getMessages(failure.test));
    if (breadcrumb && shouldShowBreadcrumb) {
      var breadcrumbString = errorMessageUtil.prettyBreadcrumb(breadcrumb, 'Last breadcrumb');
      self._stream.write(errorMessageUtil.indent(breadcrumbString, indentation));
      self._stream.write('\n');
    }
  });
};

module.exports = ErrorDetail;
