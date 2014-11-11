'use strict';

var _ = require('underscore');
var childProcess = require('child_process')
var path = require('path');
var when = require('when');
var inParallel = require('./in_parallel');
var CombinedReporter = require('./reporter/combined');
var ErrorDetectorReporter = require('./reporter/error_detector');

/**
 * Types used in this file:
 * * Test path
 * * Suite descriptor
 */

function streamToString(stream) {
  return when.promise(function(resolve) {
    var string = '';
    stream.on('data', function(data) {
      string += data;
    });
    stream.on('end', function() {
      resolve(string);
    })
  });
}

function resolveTestSuiteFile(testInterfacePath, suite) {
  var child = childProcess.fork(
    __dirname + '/test_runner',
    [testInterfacePath, suite],
    { silent: true });

  return streamToString(child.stdout)
    .then(function(string) {
      return JSON.parse(string);
    });
}

function resolveTestSuiteFiles(testInterfacePath, suites) {
  return when.all(suites.map(resolveTestSuiteFile.bind(this, testInterfacePath)))
    .then(function(suitesTests) {
      return _.flatten(suitesTests, true);
    });
}

function reportSkippedTest(reporter, testPath) {
  reporter.gotMessage(testPath, { type: 'begin' });
  reporter.gotMessage(testPath, { type: 'finish', result: 'skipped' });
}

function runTestProcess(reporter, testInterfacePath, testPath) {
  var child = childProcess.fork(
    __dirname + '/test_runner',
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

    var testError = null;
    child.on('message', function(message) {
      if (message.type === 'error') {
        testError = message.value;
      }
    });

    child.on('exit', function(code, signal) {
      if (!didTimeout) {
        reporter.gotMessage(testPath, {
          type: 'finish',
          result: code === 0 ? 'success' : 'failure',
          code: code,
          signal: signal,
          error: code !== 0 && testError
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
function filterOnly(tests) {
  var onlyTests = tests.filter(function(test) { return test.only; });
  return onlyTests.length === 0 ? tests : onlyTests;
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
 *
 * Returns a promise that succeeds if no tests fail
 */
module.exports = function(options) {
  var timeout = options.timeout || 10000;
  var testInterfacePath = path.resolve(options.interface);
  var errorDetector = new ErrorDetectorReporter();
  var reporter = new CombinedReporter([errorDetector].concat(options.reporters));

  return resolveTestSuiteFiles(testInterfacePath, options.suites)
    .then(function(tests) {
      return filterOnly(tests);
    })
    .then(function(tests) {
      if (reporter.registerTests) {
        reporter.registerTests(tests);
      }

      return inParallel(tests.map(function(test) {
          return function() {
            return runOrSkipTest(timeout, reporter, testInterfacePath, test);
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
