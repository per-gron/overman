'use strict';

var _ = require('underscore');
var fn = require('when/function');
var when = require('when');

var testInterfacePath = process.argv[2];
var testFile = process.argv[3];
var testPath = process.argv.slice(4);

var testInterface = require(testInterfacePath);
var suite = testInterface(testFile);

function searchForTest(suite, completeTestPath) {
  return (function search(contents, path, before, after) {
    var subsuite = _.find(contents, function(subsuite) {
      return subsuite.name === path[0];
    });

    if (!subsuite) {
      throw new Error('Test with path ' + JSON.stringify(completeTestPath) + ' not found');
    }

    if (path.length === 1) {
      if (subsuite.type === 'test') {
        return {
          test: subsuite,
          before: before,
          after: after
        };
      } else {
        throw new Error('Test with path ' + JSON.stringify(completeTestPath) + ' is actually a suite');
      }
    } else {
      if (subsuite.type === 'suite') {
        return search(
          subsuite.contents,
          path.slice(1),
          before.concat(subsuite.before || []),
          (subsuite.after || []).concat(after));
      } else {
        throw new Error('Test with path ' + JSON.stringify(completeTestPath) + ' not found');
      }
    }
  })(suite.contents, completeTestPath, [], []);
}

function runHooks(hooks) {
  if (hooks.length === 0) {
    return when();
  } else {
    return fn.call(hooks[0]).then(function() {
      return runHooks(hooks.slice(1));
    });
  }
}

var searchResults = searchForTest(suite, testPath);

when()
  .then(function() {
    process.send({ type: 'startedBeforeHooks' });
    return runHooks(searchResults.before);
  })
  .then(function() {
    process.send({ type: 'startedTest', result: 'success' });
    return fn.call(searchResults.test.run);
  })
  .finally(function() {
    process.send({ type: 'startedAfterHooks' });
    return runHooks(searchResults.after);
  })
  .done(function(value) {
    process.send({ type: 'finish', result: 'success', value: value });
  }, function(error) {
    process.send({ type: 'finish', result: 'failure', value: error })
  });
