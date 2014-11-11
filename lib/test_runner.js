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

// Make the process not exit(0) if the test returns a promise that never resolves.
// It would be nice if it was possible to catch this condition here and exit non-zero,
// but I don't know how to do that, so instead we make sure to time out.
var interval = setInterval(function() {}, 5000);

when()
  .then(function() {
    process.send({ type: 'startedBeforeHooks' });
    return runHooks(searchResults.before);
  })
  .then(function() {
    process.send({ type: 'startedTest' });
    return fn.call(searchResults.test.run);
  })
  .finally(function() {
    process.send({ type: 'startedAfterHooks' });
    return runHooks(searchResults.after);
  })
  .done(function(value) {
    // Don't do process.exit(0); instead, let the process finish running. If
    // there are remaining things on the runloop that never finish, the test
    // should time out.
    clearInterval(interval);
  }, function(error) {
    process.send({ type: 'error', value: error.stack });
    process.exit(1);
  });
