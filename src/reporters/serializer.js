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
var testPathUtil = require('../test_path_util');
var TestCount = require('../test_count');

function suiteIsAncestorOfOrSameAs(ancestor, descendant) {
  return (
    ancestor.file === descendant.file &&
    ancestor.path.length <= descendant.path.length &&
    _.isEqual(ancestor.path, descendant.path.slice(0, ancestor.path.length))
  );
}

/**
 * Serializer is a reporter that takes a stream of tests running potentially
 * in parallel and converts it to a stream of messages that seem like the tests
 * are running sequentially. It does this by delaying messages when necessary.
 *
 * Tests will be serialized so that if a test in a given suite has started, its
 * suite will be completely finished until any other non-descendant suite test
 * is started. This means that if a test starts running and it belongs to a new
 * suite, it is safe to print that suite name to stdout, and it will not have
 * to be printed again because the suite will finish before anything else is
 * reported.
 *
 * This is useful for use by reporters that don't support parallelism.
 */
function Serializer(reporter) {
  this._reporter = reporter;
  // Serialized test path
  this._currentTest = null;
  this._canPickNewTest = true;
  // Map from serialized test path to array of suppressed messages
  this._pendingTestMessages = {};
  this._remainingTests = new TestCount();

  // Used for providing helpful errors
  this._finishedTests = {};
}

Serializer.prototype._storeMessageForLater = function (serializedTestPath, message) {
  if (!this._pendingTestMessages[serializedTestPath]) {
    this._pendingTestMessages[serializedTestPath] = [];
  }

  this._pendingTestMessages[serializedTestPath].push(message);
};

/**
 * Emits pending messages for a given test and clears them from the queue.
 */
Serializer.prototype._emitPendingMessagesForTest = function (testPath) {
  var serializedTestPath = JSON.stringify(testPath);
  var pendingMessages = this._pendingTestMessages[serializedTestPath];
  if (this._reporter.gotMessage) {
    pendingMessages.forEach(this._reporter.gotMessage.bind(this._reporter, testPath));
  }
  delete this._pendingTestMessages[serializedTestPath];
};

Serializer.prototype._pendingTestHasFinished = function (testPath) {
  return _.last(this._pendingTestMessages[JSON.stringify(testPath)]).type === 'finish';
};

Serializer.prototype._currentTestFinished = function () {
  this._finishedTests[this._currentTest] = true;
  this._remainingTests.removeTest(JSON.parse(this._currentTest));
  this._canPickNewTest = true;
};

/**
 * Given the current test suite, finds out which suite the next test that we choose
 * must be part of.
 *
 * A null return value means that any test can be chosen.
 */
Serializer.prototype._getPremissibleSuiteForNextTest = function (currentSuite) {
  if (currentSuite.path.length === 0) {
    return null;
  } else if (this._remainingTests.numberOfTestsInSuite(currentSuite) !== 0) {
    return currentSuite;
  } else {
    return this._getPremissibleSuiteForNextTest(testPathUtil.suitePathOf(currentSuite));
  }
};

Serializer.prototype._getPermissibleNextTests = function () {
  var allPendingTests = _.keys(this._pendingTestMessages).map(JSON.parse);

  var permissibleSuiteForNextTest =
    this._currentTest &&
    this._getPremissibleSuiteForNextTest(testPathUtil.suitePathOf(JSON.parse(this._currentTest)));
  if (permissibleSuiteForNextTest) {
    return allPendingTests.filter(
      suiteIsAncestorOfOrSameAs.bind(this, permissibleSuiteForNextTest)
    );
  } else {
    return allPendingTests;
  }
};

Serializer.prototype._getNextTest = function () {
  var permissiblePendingTests = this._getPermissibleNextTests();

  if (permissiblePendingTests.length === 0) {
    return null;
  } else {
    var finishedPendingTest = _.find(
      permissiblePendingTests,
      this._pendingTestHasFinished.bind(this)
    );
    return finishedPendingTest || _.first(permissiblePendingTests);
  }
};

Serializer.prototype._pickNewCurrentTest = function () {
  var nextTest = this._getNextTest();

  if (nextTest) {
    var nextTestHasFinished = this._pendingTestHasFinished(nextTest);
    this._currentTest = JSON.stringify(nextTest);
    this._emitPendingMessagesForTest(nextTest);
    this._canPickNewTest = nextTestHasFinished;

    if (this._canPickNewTest) {
      this._currentTestFinished();
      this._pickNewCurrentTest();
    }
  }
};

Serializer.prototype.registerTests = function (testPaths) {
  this._remainingTests.addTests(testPaths);

  if (this._reporter.registerTests) {
    this._reporter.registerTests(testPaths);
  }
};

Serializer.prototype.registrationFailed = function (error) {
  if (this._reporter.registrationFailed) {
    this._reporter.registrationFailed(error);
  }
};

Serializer.prototype.gotMessage = function (testPath, message) {
  var serializedTestPath = JSON.stringify(testPath);

  if (serializedTestPath in this._finishedTests) {
    throw new Error(
      'Got message (type ' +
        message.type +
        ') for test that has already finished: ' +
        serializedTestPath
    );
  }

  if (this._currentTest === serializedTestPath) {
    if (this._reporter.gotMessage) {
      this._reporter.gotMessage(testPath, message);
    }

    if (message.type === 'finish') {
      this._currentTestFinished();
    }
  } else {
    this._storeMessageForLater(serializedTestPath, message);
  }

  if (this._canPickNewTest) {
    this._pickNewCurrentTest();
  }
};

Serializer.prototype.done = function () {
  if (_.keys(this._pendingTestMessages).length !== 0 || !this._canPickNewTest) {
    throw new Error('Got start messages that were not matched with finish messages');
  }

  if (this._reporter.done) {
    this._reporter.done();
  }
};

module.exports = Serializer;
