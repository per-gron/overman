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
var teamcityServiceMessages = require('teamcity-service-messages');
var Serializer = require('./serializer');
var SuiteMarker = require('./suite_marker');
var errorMessageUtil = require('../error_message_util');
var MessageTracker = require('./message_tracker');
var PhaseTracker = require('./phase_tracker');

teamcityServiceMessages.stdout = false;  // Global yuck :-(

// Documentation for the TeamCity reporter format:
// https://confluence.jetbrains.com/display/TCD65/Build+Script+Interaction+with+TeamCity#BuildScriptInteractionwithTeamCity-ReportingTests

/**
 * Teamcity is a reporter that reports test results in Teamcity's message
 * format.
 */
function Teamcity(stream) {
  this._stream = stream;
  this._emittedErrorForTest = {};  // Keys are JSON testPath, value is true if an error has been emitted for that test
  this._bufferedOutput = {};  // Keys are JSON testPath, value is output for the test
  this._errorTracker = new MessageTracker('error');
  this._breadcrumbTracker = new MessageTracker('breadcrumb');
  this._phaseTracker = new PhaseTracker();
}

Teamcity.prototype.registrationFailed = function(error) {
  var name = 'Processing of test files';
  this._write(teamcityServiceMessages.testStarted({ name: name }));
  this._write(teamcityServiceMessages.testFailed({
    message: 'Error when loading the test files',
    details: error.stack
  }));
  this._write(teamcityServiceMessages.testFinished({ name: name }));
};

Teamcity.prototype._write = function(string) {
  this._stream.write(string + '\n');
};

Teamcity.prototype._bufferTestOutput = function(testPath, string) {
  var key = JSON.stringify(testPath);
  if (!(key in this._bufferTestOutput)) {
    this._bufferTestOutput[key] = '';
  }
  this._bufferTestOutput[key] += string + '\n';
};

Teamcity.prototype._writeBufferedOutput = function(testPath) {
  var key = JSON.stringify(testPath);
  this._stream.write(this._bufferTestOutput[key]);
};

Teamcity.prototype._clearBufferedOutput = function(testPath) {
  var key = JSON.stringify(testPath);
  this._bufferTestOutput[key] = '';
  this._emittedErrorForTest[key] = false;
};

Teamcity.prototype._emitErrorForTest = function(testPath, args) {
  // According to the TC spec, only one testFailed should be emitted per test
  var key = JSON.stringify(testPath);
  if (!this._emittedErrorForTest[key]) {
    this._emittedErrorForTest[key] = true;
    this._bufferTestOutput(testPath, teamcityServiceMessages.testFailed(args));
  }
};

Teamcity.prototype.gotMessage = function(testPath, message) {
  var testName = testPath && _.last(testPath.path);
  var suiteName = message.suite && message.suite.path.join(' ');

  this._phaseTracker.gotMessage(testPath, message);
  this._errorTracker.gotMessage(testPath, message);
  this._breadcrumbTracker.gotMessage(testPath, message);

  if (message.type === 'stdout') {
    // ##teamcity[testStdOut name='testname' out='text']
    this._bufferTestOutput(testPath, teamcityServiceMessages.testStdOut({
      name: testName,
      out: message.data
    }));
  } else if (message.type === 'stderr') {
    // ##teamcity[testStdErr name='testname' out='error text']
    this._bufferTestOutput(testPath, teamcityServiceMessages.testStdErr({
      name: testName,
      out: message.data
    }));
  } else if (message.type === 'suiteStart') {
    if (suiteName) {  // suiteName is '' for the top level file suite
      // ##teamcity[testSuiteStarted name='suite.name']
      this._write(teamcityServiceMessages.testSuiteStarted({ name: suiteName }));
    }
  } else if (message.type === 'suiteFinish') {
    if (suiteName) {  // suiteName is '' for the top level file suite
      //##teamcity[testSuiteFinished name='suite
      this._write(teamcityServiceMessages.testSuiteFinished({ name: suiteName }));
    }
  } else if (message.type === 'timeout') {
    // ##teamcity[testFailed name='test1' message='Test timed out' details='message and stack trace']

    var indentation = 0;
    var msgs = [];

    var errors = this._errorTracker.getMessages(testPath);
    errors.forEach(function(error) {
      msgs.push(errorMessageUtil.indent(errorMessageUtil.prettyError(error), indentation) + '\n');
    });

    var lastPhase = this._phaseTracker.getLastPhase(testPath);
    msgs.push(errorMessageUtil.indent(errorMessageUtil.prettyTimeout(lastPhase), indentation));

    var breadcrumb = _.last(this._breadcrumbTracker.getMessages(testPath));
    if (breadcrumb) {
      var breadcrumbString = errorMessageUtil.prettyBreadcrumb(breadcrumb, 'Last breadcrumb');
      msgs.push(errorMessageUtil.indent(breadcrumbString, indentation));
    }

    var timeoutMessage = {
      name: testName,
      message: 'Timed out: ' + (breadcrumb ? breadcrumb.message : 'missing breadcrumb'),
      details: msgs.join('\n')
    };
    this._emitErrorForTest(testPath, timeoutMessage);
  } else if (message.type === 'error') {
    // possibly: ##teamcity[testFailed name='test1' message='failure message' details='message and stack trace']
    // possibly: ##teamcity[testFailed type='comparisonFailure' name='test2' message='failure message' details='message and stack trace' expected='expected value' actual='actual value']
    var stack = typeof message.stack === 'string' ? message.stack : JSON.stringify(message);
    var errorMessage = {
      name: testName,
      message: stack.split(/\n/)[0],
      details: stack
    };

    if (message.expected && message.actual) {
      _.assign(errorMessage, {
        type: 'comparisonFailure',
        expected: message.expected,
        actual: message.actual
      });
    }

    this._emitErrorForTest(testPath, errorMessage);
  } else if (message.type === 'start' || message.type === 'retry') {
    this._clearBufferedOutput(testPath);
    var name = testName + (message.unstable ? ' [unstable]' : '');

    // for skipped tests: ##teamcity[testIgnored name='testname' message='ignore comment']
    // for other tests: ##teamcity[testStarted name='testname']
    if (message.skipped) {
      this._bufferTestOutput(testPath, teamcityServiceMessages.testIgnored({ name: name }));
    } else {
      this._bufferTestOutput(testPath, teamcityServiceMessages.testStarted({ name: name }));
    }
  } else if (message.type === 'finish') {
    if (message.result === 'aborted') {
      this._emitErrorForTest(testPath, { name: testName, message: 'Test aborted' });
    } else if (message.result === 'failure') {
      // This should really never happen, but it could if the test just exits
      // with a non-zero exit status.
      this._emitErrorForTest(testPath, { name: testName, message: 'Test failed (unknown reason)' });
    }

    // and then: ##teamcity[testFinished name='testname' duration='50']
    if (message.result !== 'skipped') {
      var finishedMsg = { name: testName };
      if ('duration' in message) {
        _.assign(finishedMsg, { duration: message.duration });
      }
      this._bufferTestOutput(testPath, teamcityServiceMessages.testFinished(finishedMsg));
    }

    this._writeBufferedOutput(testPath);
  }
};

module.exports = function(stream) {
  return new Serializer(
    new SuiteMarker(
      new Teamcity(stream)));
};
