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

var TestCount = require('../test_count');
var testPathUtil = require('../test_path_util');
var Combined = require('./combined');

/**
 * SuiteMarker is a reporter that emits extra messages that contain information
 * about when a test suite has started and when it is finished. Before any test
 * that is within a suite (direct child or ancestor) runs, a 'suiteStart'
 * message is emitted. After the last test in a suite has run, a 'suiteFinish'
 * message is emitted. The messages are emitted with null testPaths and have the
 * format
 *
 *   { "type": ["suiteStart"|"suiteFinish"], "suite": [suite path] }
 *
 * Suites that don't have any tests are not reported.
 *
 * The SuiteMarker reporter can be run directly, but I expect it to most often
 * be used together with the Serializer reporter; that way, the receiving
 * reporter will get messages as if the tests are run serially and with
 * information about when suites start and end.
 */
function SuiteMarker(reporter) {
  Combined.call(this, [reporter]);
  this._reporter = reporter;
  this._totalTests = new TestCount();
  this._remainingTests = new TestCount();
}
SuiteMarker.prototype = Object.create(Combined.prototype);

SuiteMarker.prototype.registerTests = function(tests) {
  Combined.prototype.registerTests.call(this, tests);
  this._totalTests.addTests(tests);
  this._remainingTests.addTests(tests);
};

SuiteMarker.prototype._maybeEmitSuiteStart = function(suitePath) {
  if (suitePath === null) {
    return;
  }

  var totalTestsInSuite = this._totalTests.numberOfTestsInSuite(suitePath);
  var remainingTestsInSuite = this._remainingTests.numberOfTestsInSuite(suitePath);
  if (totalTestsInSuite === remainingTestsInSuite) {
    this._maybeEmitSuiteStart(testPathUtil.suitePathOf(suitePath));
    Combined.prototype.gotMessage.call(this, null, {
      type: 'suiteStart',
      suite: suitePath
    });
  }
};

SuiteMarker.prototype._maybeEmitSuiteFinish = function(suitePath) {
  if (suitePath !== null && this._remainingTests.numberOfTestsInSuite(suitePath) === 0) {
    Combined.prototype.gotMessage.call(this, null, {
      type: 'suiteFinish',
      suite: suitePath
    });
    this._maybeEmitSuiteFinish(testPathUtil.suitePathOf(suitePath));
  }
};

SuiteMarker.prototype.gotMessage = function(testPath, message) {
  var suitePath = testPathUtil.suitePathOf(testPath);

  if (message.type === 'start') {
    this._maybeEmitSuiteStart(suitePath);
    this._remainingTests.removeTest(testPath);
  }

  Combined.prototype.gotMessage.call(this, testPath, message);

  if (message.type === 'finish') {
    this._maybeEmitSuiteFinish(suitePath);
  }
};

module.exports = SuiteMarker;
