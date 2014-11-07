'use strict';

var path = require('path');
var childProcess = require('child_process')
var _ = require('underscore');

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

function runTest(testInterfacePath, testPath) {
  childProcess.fork(__dirname + '/test_runner.js', [testInterfacePath, testPath.file].concat(testPath.path));
}

/**
 * Run a set of test suites. Options is an object that can have the following keys:
 *
 * suites: Array of paths to suite files to test. Required.
 * interface: Path to interface file. Required.
 * reporter: Array of reporter objects. Required.
 * retries: Number of times to re-try a test when it fails. Defaults to 1.
 * debug: Debug mode. Defaults to false.
 * match: Regex or string. Only tests that match the criteria will be run.
 */
module.exports = function(options) {
  var testInterfacePath = path.resolve(options.interface);
  var testInterface = require(testInterfacePath);
  var tests = resolveTestSuiteFiles(testInterface, options.suites);

  tests.forEach(runTest.bind(this, testInterfacePath));
}
