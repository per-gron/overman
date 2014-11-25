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

var async = require('async');
var childProcess = require('child_process')
var nodefn = require('when/node');
var path = require('path');
var when = require('when');
var listSuite = require('./list_suite');
var CombinedReporter = require('./reporter/combined');
var ErrorDetectorReporter = require('./reporter/error_detector');
var TimeoutTimer = require('./timeout_timer');

/**
 * Types used in this file:
 * * Test path
 * * Suite descriptor
 */

function reportSkippedTest(reporter, testPath) {
  reporter.gotMessage(testPath, { type: 'start' });
  reporter.gotMessage(testPath, { type: 'finish', result: 'skipped' });
}

function runTestProcess(childProcess, timeout, reporter, testInterfacePath, testPath) {
  var child = childProcess.fork(
    __dirname + '/bin/run_test',
    [testInterfacePath, timeout, testPath.file].concat(testPath.path),
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

/**
 * Sends a SIGINT to the child process. If it is still not dead
 * after a short while, it sends SIGKILL.
 */
function softKillChild(child) {
  var timeout = setTimeout(function() {
    child.kill('SIGKILL');
  }, 500);

  child.on('exit', function() {
    clearTimeout(timeout);
  });
  child.kill('SIGINT');
}

function killAfter(child, timeToWait, willKill) {
  var timer = new TimeoutTimer(timeToWait);
  timer.on('timeout', function() {
    willKill();
    softKillChild(child);
  });

  child.on('exit', function(code, signal) {
    timer.cancel();
  });

  child.on('message', function(message) {
    if (message.type === 'setTimeout' && typeof message.value === 'number') {
      timer.updateTimeout(message.value);
    }
  });
}

function runTest(childProcess, timeout, reporter, testInterfacePath, testPath) {
  reporter.gotMessage(testPath, { type: 'start' });

  var child = runTestProcess(childProcess, timeout, reporter, testInterfacePath, testPath);

  var didTimeout = false;
  killAfter(child, timeout, function() {
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
        .done(function() {
          if (!didTimeout) {
            reporter.gotMessage(testPath, {
              type: 'finish',
              result: code === 0 ? 'success' : 'failure',
              code: code,
              signal: signal
            });
          }

          if (signal) {
            reject(new Error('Test process exited with signal ' + signal));
          } else if (code === 0) {
            resolve();
          } else {
            reject(new Error('Test process exited with non-zero exit code ' + code));
          }
        }, reject);
    });
  });
}

function runOrSkipTest(childProcess, timeout, reporter, testInterfacePath, testDescriptor) {
  var testPath = testDescriptor.path;

  if (testDescriptor.skipped) {
    reportSkippedTest(reporter, testPath);
    return when.resolve();
  } else {
    return runTest(childProcess, timeout, reporter, testInterfacePath, testPath);
  }
}

/**
 * Takes a list of tests. If none of the tests are marked as "only", then returns
 * the entire list. Otherwise returns only the tests that are marked as "only".
 */
function filterOnly(disallowOnly, tests) {
  var onlyTests = tests.filter(function(test) { return test.only; });

  if (disallowOnly && onlyTests.length !== 0) {
    throw new Error('Encountered tests marked as .only, and the disallow_only flag is set');
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

/**
 * Run a set of test suites. Options is an object that can have the following keys:
 *
 * suites: Array of paths to suite files to test. Required.
 * timeout: Default test timeout in ms. Defaults to 10000
 * interface: Path to interface file. Required.
 * reporters: Array of reporter objects. Required.
 * retries: Number of times to re-try a test when it fails. Defaults to 1.
 * parallelism: Number of tests to run in parallel. Defaults to 1.
 * debug: Debug mode. Defaults to false.
 * match: Regex or string. Only tests that match the criteria will be run.
 * disallow_only: Fail if there are tests marked as only. This may be useful to set on CI servers, to catch tests mistakenly checked in as only.
 * child_process: Injecting the child_process module for mocking. Optional and only useful for internal testing.
 *
 * Returns a promise that succeeds if no tests fail
 */
module.exports = function(options) {
  var timeout = options.timeout || 10000;
  var testInterfacePath = path.resolve(options.interface);
  var errorDetector = new ErrorDetectorReporter();
  var reporter = new CombinedReporter([errorDetector].concat(options.reporters));

  return listSuite.listTestsOfFiles(testInterfacePath, options.suites)
    .then(filterOnly.bind(this, options.disallow_only))
    .then(filterMatch.bind(this, options.match))
    .then(function(tests) {
      if (reporter.registerTests) {
        reporter.registerTests(tests.map(function(test) { return test.path; }));
      }

      return nodefn.call(async.parallelLimit, tests.map(function(test) {
          return function(done) {
            return runOrSkipTest(options.child_process || childProcess, timeout, reporter, testInterfacePath, test)
              .done(done.bind(this, null), done.bind(this, null));
          };
        }), options.parallelism || 1);
    })
    .then(function() {
      if (reporter.done) {
        reporter.done();
      }

      if (errorDetector.didFail()) {
        throw new Error('Tests failed');
      }
    });
}
