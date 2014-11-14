'use strict';

var _ = require('lodash');

/**
 * Serializer is a reporter that takes a stream of tests running potentially
 * in parallel and converts it to a stream of messages that seem like the tests
 * are running sequentially. It does this by delaying messages when necessary.
 *
 * This is useful for use by reporters that don't support parallelism.
 */
function Serializer(reporter) {
  this._reporter = reporter;
  // Serialized test path
  this._currentTest = null;
  // Map from serialized test path to array of suppressed messages
  this._pendingTestMessages = {};
}

Serializer.prototype._storeMessageForLater = function(serializedTestPath, message) {
  if (!this._pendingTestMessages[serializedTestPath]) {
    this._pendingTestMessages[serializedTestPath] = [];
  }

  this._pendingTestMessages[serializedTestPath].push(message);
};

/**
 * Emits pending messages for a given test and clears them from the queue.
 */
Serializer.prototype._emitPendingMessagesForTest = function(serializedTestPath) {
  var testPath = JSON.parse(serializedTestPath);
  var pendingMessages = self._pendingTestMessages[serializedTestPath];
  pendingMessages.forEach(self._reporter.gotMessage.bind(self._reporter, testPath));
  delete self._pendingTestMessages[serializedTestPath];
};

Serializer.prototype._pickNewCurrentTest = function() {
  var pendingTests = _.keys(this._pendingTestMessages);
  if (pendingTests.length === 0) {
    return;
  }

  var pendingTest = pendingTests[0];
  this._currentTest = pendingTest;
  this._emitPendingMessagesForTest(pendingTest);
};

Serializer.prototype.registerTests = function(testPaths) {
  if (this._reporter.registerTests) {
    this._reporter.registerTests(testPaths);
  }
};

Serializer.prototype.gotMessage = function(testPath, message) {
  var serializedTestPath = JSON.stringify(testPath);
  if (!this._currentTest) {
    this._currentTest = serializedTestPath;
  }

  if (this._currentTest === serializedTestPath) {
    this._reporter.gotMessage(testPath, message);

    if (message.type === 'finish') {
      this._currentTest = null;
      this._pickNewCurrentTest();
    }
  } else {
    this._storeMessageForLater(serializedTestPath, message);
  }
};

Serializer.prototype.done = function() {
  _.keys(this._pendingTestMessages).forEach(this._emitPendingMessagesForTest.bind(this));

  if (this._reporter.done) {
    this._reporter.done();
  }
};

module.exports = Serializer;
