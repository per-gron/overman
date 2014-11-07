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

function testsOfSuite(file, suite, suitePath) {
  suitePath = suitePath || [];

  if (suite.type === 'test') {
    return [{
      file: file,
      path: suitePath.concat([suite.name])
    }];
  } else if (suite.type === 'suite') {
    var subPath = suite.name ? suitePath.concat([suite.name]) : suitePath;
    return _.flatten(suite.contents.map(function(subSuite) {
      return testsOfSuite(file, subSuite, subPath);
    }), true);
  } else {
    throw new Error('Unrecognized suite type '+suite.type);
  }
}

function resolveTestSuiteFiles(testInterface, suiteFiles) {
  return _.flatten(suiteFiles.map(function(suiteFile) {
    return testsOfSuite(suiteFile, testInterface(suiteFile));
  }), true);
}

function runTest(reporter, testInterfacePath, testPath) {
  return when.promise(function(resolve, reject) {
    var child = childProcess.fork(
      __dirname + '/test_runner',
      [testInterfacePath, testPath.file].concat(testPath.path),
      { silent: true });

    reporter.gotMessage(testPath, {
      type: 'begin',
      stdin: child.stdin,
      stdout: child.stdout,
      stderr: child.stderr
    });

    child.on('exit', function(code, signal) {
      reporter.gotMessage(testPath, { type: 'finish', code: code, signal: signal });

      if (signal) {
        reject(new Error('Test process exited with signal ' + signal));
      } else if (code === 0) {
        resolve();
      } else {
        reject(new Error('Test process exited with non-zero exit code ' + code));
      }
    });

    child.on('message', function(message) {
      reporter.gotMessage(testPath, message);
    });
  });
}

/**
 * Run a set of test suites. Options is an object that can have the following keys:
 *
 * suites: Array of paths to suite files to test. Required.
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
  var testInterfacePath = path.resolve(options.interface);
  var testInterface = require(testInterfacePath);
  var tests = resolveTestSuiteFiles(testInterface, options.suites);
  var errorDetector = new ErrorDetectorReporter();
  var reporter = new CombinedReporter([errorDetector].concat(options.reporters));

  reporter.registerTests(tests);

  return inParallel(tests.map(function(test) {
      return function() {
        return runTest(reporter, testInterfacePath, test);
      };
    }), options.parallelism || 1)
    .then(function() {
      reporter.done();

      if (errorDetector.didFail()) {
        throw new Error('Tests failed');
      }
    });
}
