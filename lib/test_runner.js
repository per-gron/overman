'use strict';

var _ = require('underscore');

var testInterfacePath = process.argv[2];
var testFile = process.argv[3];
var testPath = process.argv.slice(4);

var testInterface = require(testInterfacePath);
var suite = testInterface(testFile);

function resolveTestPath(suite, completeTestPath) {
  return (function search(contents, path) {
    var subsuite = _.find(contents, function(subsuite) {
      return subsuite.name === path[0];
    });

    if (!subsuite) {
      throw new Error('Test with path ' + JSON.stringify(completeTestPath) + ' not found');
    }

    if (path.length === 1) {
      if (subsuite.type === 'test') {
        return subsuite;
      } else {
        throw new Error('Test with path ' + JSON.stringify(completeTestPath) + ' is actually a suite');
      }
    } else {
      if (subsuite.type === 'suite') {
        return search(subsuite.contents, path.slice(1));
      } else {
        throw new Error('Test with path ' + JSON.stringify(completeTestPath) + ' not found');
      }
    }
    console.log(contents, path);
  })(suite.contents, completeTestPath);
}

var test = resolveTestPath(suite, testPath);

test.run();
