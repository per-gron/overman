'use strict';

var _ = require('underscore');
var childProcess = require('child_process')
var path = require('path');
var when = require('when');
var fn = require('when/function');

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
    var child = childProcess.fork(__dirname + '/test_runner', [testInterfacePath, testPath.file].concat(testPath.path));

    child.on('exit', function(code, signal) {
      if (signal) {
        reject(new Error('Test process exited with signal ' + signal));
      } else if (code === 0) {
        resolve();
      } else {
        reject(new Error('Test process exited with non-zero exit code ' + code));
      }
    });

    child.on('message', function(message) {
      reporter(testPath, message);
    });
  });
}

function combinedReporter(reporters) {
  return function() {
    var args = arguments;
    reporters.forEach(function(reporter) {
      reporter.apply(this, args);
    });
  };
}

/**
 * Takes an array of functions that may return a value or a promise
 * and runs them in parallel, but at most parallelism promises will
 * be allowed to be unresolved at any given time.
 *
 * Returns a promise of an array of the results of the functions.
 * The functions that failed will have their error as their value.
 * The returned promise never fails.
 *
 * This is how we run N tests in parallel.
 */
function executeFunctionsInParallel(functions, parallelism) {
  return when.promise(function(resolve) {
    var startedFunctions = 0;
    var finishedFunctions = 0;
    var results = [];

    function process() {
      if (results && finishedFunctions >= functions.length) {
        resolve(finishedFunctions);
        results = null;  // Mark ourselves as done so we don't resolve twice
        return;
      } else if (startedFunctions >= functions.length) {
        // No more work to do
        return;
      }

      var functionToRun = startedFunctions++;
      function handleFinish(value) {
        results[functionToRun] = value;
        process();
      }
      fn.call(functions[functionToRun])
        .done(handleFinish, handleFinish);
    }

    for (var i = 0; i < parallelism; i++) {
      process();
    }
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
 */
module.exports = function(options) {
  var testInterfacePath = path.resolve(options.interface);
  var testInterface = require(testInterfacePath);
  var tests = resolveTestSuiteFiles(testInterface, options.suites);
  var reporter = combinedReporter(options.reporters);

  executeFunctionsInParallel(tests.map(function(test) {
      return function() {
        return runTest(reporter, testInterfacePath, test);
      };
    }), options.parallelism || 1)
    .done();
}
