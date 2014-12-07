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
var async = require('async');
var childProcess = require('child_process');
var nodefn = require('when/node');
var path = require('path');
var when = require('when');
var listSuite = require('./list_suite');
var softKill = require('./soft_kill');
var CombinedReporter = require('./reporter/combined');
var CancellableReporter = require('./reporter/cancellable');
var ErrorDetectorReporter = require('./reporter/error_detector');
var TimerReporter = require('./reporter/timer');
var TestFailureError = require('./test_failure_error');
var TimeoutTimer = require('./timeout_timer');

/**
 * Types used in this file:
 * * Test path
 * * Suite descriptor
 */

function reportSkippedTest(reporter, testPath) {
  reporter.gotMessage(testPath, { type: 'finish', result: 'skipped' });
}

function runTestProcess(childProcess, timeout, slowThreshold, reporter, testInterfacePath, testPath) {
  var parameters = {
    timeout: timeout,
    slowThreshold: slowThreshold
  };
  var child = childProcess.fork(
    __dirname + '/bin/run_test',
    [testInterfacePath, JSON.stringify(parameters), testPath.file].concat(testPath.path),
    { silent: true });

  reporter.gotMessage(testPath, {
    type: 'stdio',
    stdin: child.stdin,
    stdout: child.stdout,
    stderr: child.stderr
  });

  child.on('message', function(message) {
    reporter.gotMessage(testPath, message);
  });

  return child;
}

function killAfter(softKill, child, timeToWait, graceTime, willKill) {
  var timer = new TimeoutTimer(timeToWait);
  timer.on('timeout', function() {
    willKill();
    softKill(child, graceTime);
  });

  child.on('exit', function() {
    timer.cancel();
  });

  child.on('message', function(message) {
    if (message.type === 'setTimeout' && typeof message.value === 'number') {
      timer.updateTimeout(message.value);
    }
  });
}

function runTest(softKill, childProcess, timeout, graceTime, slowThreshold, reporter, testInterfacePath, testPath) {
  var child = runTestProcess(childProcess, timeout, slowThreshold, reporter, testInterfacePath, testPath);

  var didTimeout = false;
  killAfter(softKill, child, timeout, graceTime, function() {
    didTimeout = true;
    reporter.gotMessage(testPath, { type: 'finish', result: 'timeout' });
  });

  var closePromise = when.promise(function(resolve) {
    child.on('close', function() {
      resolve();
    });
  });

  return when.promise(function(resolve, reject) {
    child.on('exit', function(code, signal) {
      // The 'close' event is typically emitted *after* the 'exit' event. This means
      // that when we get to this point, there may still be outstanding messages in
      // flight from the child process. Because of that, we need to wait for 'close'.
      closePromise
        .done(function() {
          if (didTimeout) {
            // By now we have already sent a non-success finish message, so we
            // must make sure to reject the promise, otherwise the test won't be
            // retried.
            reject(new Error('Test timed out'));
          } else {
            reporter.gotMessage(testPath, {
              type: 'finish',
              result: code === 0 ? 'success' : 'failure',
              code: code,
              signal: signal
            });

            if (code === 0) {
              resolve();
            } else if (signal) {
              reject(new Error('Test process exited with signal ' + signal));
            } else {
              reject(new Error('Test process exited with non-zero exit code ' + code));
            }
          }
        }, reject);
    });
  });
}

function runTestWithRetries(softKill, childProcess, timeout, graceTime, attempts, slowThreshold, reporter, testInterfacePath, testPath) {
  // When tests are retried, we need to "lie" about the finish message; tests
  // that are retried aren't actually finished, so they should not be reported
  // as such.
  var retryingReporter = Object.create(reporter);
  retryingReporter.gotMessage = function(testPath, message) {
    if (attempts > 1 && message.type === 'finish') {
      reporter.gotMessage(testPath, _.extend({}, message, { type: 'retry' }));
    } else {
      reporter.gotMessage(testPath, message);
    }
  };

  return runTest(softKill, childProcess, timeout, graceTime, slowThreshold, retryingReporter, testInterfacePath, testPath)
    .catch(function(error) {
      if (attempts <= 1) {
        throw error;
      } else {
        return runTestWithRetries(softKill, childProcess, timeout, graceTime, attempts - 1, slowThreshold, reporter, testInterfacePath, testPath);
      }
    });
}

function runOrSkipTest(softKill, childProcess, attempts, timeout, graceTime, slowThreshold, reporter, testInterfacePath, testDescriptor) {
  var testPath = testDescriptor.path;

  reporter.gotMessage(testPath, { type: 'start' });
  if (testDescriptor.skipped) {
    reportSkippedTest(reporter, testPath);
    return when.resolve();
  } else {
    return runTestWithRetries(softKill, childProcess, timeout, graceTime, attempts, slowThreshold, reporter, testInterfacePath, testPath);
  }
}

/**
 * Takes a list of tests. If none of the tests are marked as "only", then returns
 * the entire list. Otherwise returns only the tests that are marked as "only".
 */
function filterOnly(disallowOnly, tests) {
  var onlyTests = tests.filter(function(test) { return test.only; });

  if (disallowOnly && onlyTests.length !== 0) {
    throw new Error('Encountered tests marked as .only, and the disallowOnly flag is set');
  }

  return onlyTests.length === 0 ? tests : onlyTests;
}

function filterMatch(match, tests) {
  if (!match) {
    return tests;
  }

  return tests.filter(function(test) {
    return test.path.path.join(' ').match(match);
  });
}

function listTestsOfFiles(timeout, testInterfacePath, suites) {
  return when.all(suites.map(function(suite) {
      return listSuite.listTestsOfFile(timeout, testInterfacePath, suite);
    }))
    .then(function(suitesTests) {
      return _.flatten(suitesTests, true);
    });
}

function listTests(reporter, timeout, testInterfacePath, suites) {
  return listTestsOfFiles(timeout, testInterfacePath, suites)
    .catch(listSuite.ListTestError, function(error) {
      if (reporter.registrationFailed) {
        reporter.registrationFailed(error);
      }
      if (error.timeout) {
        throw new TestFailureError(error.message);
      } else {
        throw new TestFailureError('Failed to process test files');
      }
    });
}

/**
 * Run a set of test suites. Options is an object that can have the following keys:
 *
 * suites: Array of paths to suite files to test. Required.
 * timeout: Default test timeout in ms. Defaults to 10000
 * listingTimeout: Timeout for listing tests. Defaults to 1000
 * graceTime: Time that a test process has to shut down after a timeout (and it gets SIGINT) before it is hard killed.
 * slowThreshold: The time, in ms, a test should take to be considered slow. Defaults to 1000
 * interface: Path to interface file. Required.
 * reporters: Array of reporter objects. Required.
 * attempts: Maximum number of times to run a test; if >1 the test will be retried on failure. Defaults to 1.
 * parallelism: Number of tests to run in parallel. Defaults to 1.
 * debug: Debug mode. Defaults to false.
 * match: Regex or string. Only tests that match the criteria will be run.
 * disallowOnly: Fail if there are tests marked as only. This may be useful to set on CI servers, to catch tests mistakenly checked in as only.
 * childProcess: Injecting the child_process module for mocking. Optional and only useful for internal testing.
 * softKill: Injecting the soft_kill module for mocking. Optional and only useful for internal testing.
 *
 * Returns a promise that succeeds if no tests fail. If one or more tests fail,
 * the promise will fail with a TestFailureError. If the promise fails with any
 * other type of error, it means that there is a bug, for example in a reporter
 * or in the suite runner.
 */
module.exports = function(options) {
  var timeout = options.timeout || 10000;
  var listingTimeout = options.listingTimeout || 1000;
  var slowThreshold = options.slowThreshold || 1000;
  var graceTime = options.graceTime || 500;
  var attempts = options.attempts || 0;
  var testInterfacePath = path.resolve(options.interface);
  var errorDetector = new ErrorDetectorReporter();
  var reporter = new CancellableReporter(
    new TimerReporter(
      new CombinedReporter([errorDetector].concat(options.reporters)),
      slowThreshold));

  var cancelled = false;

  var resultPromise = listTests(reporter, listingTimeout, testInterfacePath, options.suites)
    .then(filterOnly.bind(this, options.disallowOnly))
    .then(filterMatch.bind(this, options.match))
    .then(function(tests) {
      if (reporter.registerTests) {
        reporter.registerTests(tests.map(function(test) { return test.path; }));
      }

      return nodefn.call(async.parallelLimit, tests.map(function(test) {
          return function(done) {
            if (cancelled) {
              done(null);
            } else {
              return runOrSkipTest(
                  options.softKill || softKill,
                  options.childProcess || childProcess,
                  attempts,
                  timeout,
                  graceTime,
                  slowThreshold,
                  reporter,
                  testInterfacePath,
                  test)
                .done(done.bind(this, null), done.bind(this, null));
            }
          };
        }), options.parallelism || 1);
    })
    .then(function() {
      if (reporter.done) {
        reporter.done();
      }

      if (cancelled) {
        throw new TestFailureError('Tests cancelled');
      } else if (errorDetector.didFail()) {
        throw new TestFailureError('Tests failed');
      }
    });

  resultPromise.cancel = function() {
    cancelled = true;
    reporter.cancel();
  };

  return resultPromise;
};
