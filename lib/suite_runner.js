'use strict';

var async = require('async');
var childProcess = require('child_process')
var nodefn = require('when/node');
var path = require('path');
var when = require('when');
var listSuite = require('./list_suite');
var CombinedReporter = require('./reporter/combined');
var ErrorDetectorReporter = require('./reporter/error_detector');

/**
 * Types used in this file:
 * * Test path
 * * Suite descriptor
 */

function reportSkippedTest(reporter, testPath) {
  reporter.gotMessage(testPath, { type: 'begin' });
  reporter.gotMessage(testPath, { type: 'finish', result: 'skipped' });
}

function runTestProcess(reporter, testInterfacePath, testPath) {
  var child = childProcess.fork(
    __dirname + '/bin/run_test',
    [testInterfacePath, testPath.file].concat(testPath.path),
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
 * Sends a SIGTERM to the child process. If it is still not dead
 * after a short while, it sends SIGKILL.
 */
function softKillChild(child) {
  var timeout = setTimeout(function() {
    child.kill('SIGKILL');
  }, 500);

  child.on('exit', function() {
    clearTimeout(timeout);
  });
  child.kill();
}

function killAfter(child, timeToWait, willKill) {
  var timeout = setTimeout(function() {
    willKill();
    softKillChild(child);
  }, timeToWait);

  child.on('exit', function(code, signal) {
    clearTimeout(timeout);
  });
}

function runTest(timeout, reporter, testInterfacePath, testPath) {
  return when.promise(function(resolve, reject) {
    reporter.gotMessage(testPath, { type: 'begin' });

    var child = runTestProcess(reporter, testInterfacePath, testPath);

    var didTimeout = false;
    killAfter(child, timeout, function() {
      didTimeout = true;
      reporter.gotMessage(testPath, { type: 'finish', result: 'timeout' });
    });

    child.on('exit', function(code, signal) {
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
    });
  });
}

function runOrSkipTest(timeout, reporter, testInterfacePath, testDescriptor) {
  var testPath = testDescriptor.path;

  if (testDescriptor.skipped) {
    reportSkippedTest(reporter, testPath);
    return when.resolve();
  } else {
    return runTest(timeout, reporter, testInterfacePath, testPath);
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
            return runOrSkipTest(timeout, reporter, testInterfacePath, test)
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
