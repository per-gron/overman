'use strict';

/**
 * Test suite that verifies that reporters get the messages they're supposed to
 * get.
 */

var path = require('path');
var when = require('when');
var OnMessage = require('../lib/reporter/on_message');
var suiteRunner = require('../lib/suite_runner');

function runTestSuite(suite, reporter) {
  return suiteRunner({
      suites: [__dirname + '/' + suite],
      interface: __dirname + '/../lib/interface/bdd_mocha',
      timeout: 500,
      reporters: [reporter]
    });
}

function ensureOneMessage(suite, predicate) {
  return when.promise(function(resolve, reject) {
    var foundMessage = false;

    var reporter = new OnMessage(function(testPath, message) {
      foundMessage = foundMessage || predicate(testPath, message);
    });

    function finish() {
      if (foundMessage) {
        resolve();
      } else {
        reject(new Error('Did not get expected message'));
      }
    }

    runTestSuite(suite, reporter).done(finish, finish);
  });
}

function ensureAllMessages(suite, predicate) {
  return when.promise(function(resolve, reject) {
    var done = false;

    var reporter = new OnMessage(function(testPath, message) {
      if (!done && !predicate(testPath, message)) {
        done = true;
        reject(new Error('Encountered unexpected message from skipped test: ' + message.type));
      }
    });

    function finish() {
      if (!done) {
        done = true;
        resolve();
      }
    }

    runTestSuite(suite, reporter).done(finish, finish);
  });
}

describe('Reporter API', function() {
  it('should emit begin message', function() {
    return ensureOneMessage('suite_single_successful_test', function(testPath, message) {
      return message.type === 'begin';
    });
  });

  it('should emit stdio message', function() {
    return ensureOneMessage('suite_single_successful_test', function(testPath, message) {
      return (message.type === 'stdio' &&
              message.stdin &&
              message.stdout &&
              message.stderr);
    });
  });

  it('should emit startedBeforeHooks message', function() {
    return ensureOneMessage('suite_single_successful_test', function(testPath, message) {
      return message.type === 'startedBeforeHooks';
    });
  });

  it('should emit startedTest message', function() {
    return ensureOneMessage('suite_single_successful_test', function(testPath, message) {
      return message.type === 'startedTest';
    });
  });

  it('should emit startedAfterHooks message', function() {
    return ensureOneMessage('suite_single_successful_test', function(testPath, message) {
      return message.type === 'startedAfterHooks';
    });
  });

  it('should emit finish message for successful test', function() {
    return ensureOneMessage('suite_single_successful_test', function(testPath, message) {
      return (message.type === 'finish' &&
              message.result === 'success' &&
              message.code === 0);
    });
  });

  it('should emit finish message for failing test', function() {
    return ensureOneMessage('suite_single_throwing_test', function(testPath, message) {
      return (message.type === 'finish' &&
              message.result === 'failure' &&
              message.code === 1);
    });
  });

  it('should emit finish message for skipped test', function() {
    return ensureOneMessage('suite_single_skipped_test', function(testPath, message) {
      return (message.type === 'finish' &&
              message.result === 'skipped');
    });
  });

  it('should emit finish message for test that times out', function() {
    return ensureOneMessage('suite_single_test_that_never_finishes', function(testPath, message) {
      return (message.type === 'finish' &&
              message.result === 'timeout');
    });
  });

  it('should emit only begin and finish message for skipped test', function() {
    return ensureAllMessages('suite_single_skipped_test', function(testPath, message) {
      return message.type === 'begin' || message.type === 'finish';
    });
  });

  it('should emit messages with a correct test path', function() {
    var suite = 'suite_single_skipped_test';
    return ensureAllMessages(suite, function(testPath, message) {
      return (testPath.file === path.resolve(__dirname + '/' + suite));
    });
  });
});
