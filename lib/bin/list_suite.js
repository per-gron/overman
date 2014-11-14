/**
 * This file is a runnable script that takes two command line arguments:
 *
 * 1) An absolute path to the test interface
 * 2) An absolute path to the suite file
 *
 * Its output is a list of the tests that are declared in the suite file,
 * in JSON format to stdout.
 */

'use strict';

var _ = require('lodash');
var fn = require('when/function');
var when = require('when');

function testsOfSuite(file, suite, suitePath, skipped, only) {
  suitePath = suitePath || [];

  if (suite.type === 'test') {
    return [{
      path: {
        file: file,
        path: suitePath.concat([suite.name])
      },
      skipped: skipped || suite.skipped,
      only: only || suite.only
    }];
  } else if (suite.type === 'suite') {
    var subPath = suite.name ? suitePath.concat([suite.name]) : suitePath;
    return _.flatten(suite.contents.map(function(subSuite) {
      return testsOfSuite(file, subSuite, subPath, skipped || subSuite.skipped, only || subSuite.only);
    }), true);
  } else {
    throw new Error('Unrecognized suite type '+suite.type);
  }
}

var testInterfacePath = process.argv[2];
var testFile = process.argv[3];

var testInterface = require(testInterfacePath);
var suite = testInterface(testFile);

console.log(JSON.stringify(testsOfSuite(testFile, suite)));
