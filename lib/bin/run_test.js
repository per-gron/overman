/**
 * This file is a runnable script that takes three or more command line arguments:
 *
 * 1) An absolute path to the test interface
 * 2) An absolute path to the test file
 * 3+) The "test path", for example ["Suite", "Subsuite", "Test"]
 *
 * It runs the test specified by the arguments and reports the result. An exit code
 * 0 means that the test succeeded, non-0 means that the test failed. More detailed
 * information about the test run is reported to its parent process over process.send.
 */

'use strict';

var _ = require('underscore');
var fn = require('when/function');
var when = require('when');

function invokeFunction(fun) {
  if (fun.length > 0) {
    return when.promise(function(resolve, reject) {
      fun(function(error) {
        if (error) {
          reject(error);
        } else {
          resolve();
        }
      });
    });
  } else {
    return fn.call(fun);
  }
}

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
  })(suite.contents, completeTestPath, suite.before || [], suite.after || []);
}

function runHooks(messageType, hooks) {
  if (hooks.length === 0) {
    return when();
  } else {
    var hook = hooks[0];
    process.send({ type: messageType, name: hook.name });
    return invokeFunction(hook.run).then(function() {
      return runHooks(messageType, hooks.slice(1));
    });
  }
}

function runTest(testPath) {
  var searchResults = searchForTest(suite, testPath);

  // Make the process not exit(0) if the test returns a promise that never resolves.
  // It would be nice if it was possible to catch this condition here and exit non-zero,
  // but I don't know how to do that, so instead we make sure to time out.
  var interval = setInterval(function() {}, 5000);

  when()
    .then(function() {
      process.send({ type: 'startedBeforeHooks' });
      return runHooks('startedBeforeHook', searchResults.before);
    })
    .then(function() {
      process.send({ type: 'startedTest' });
      return invokeFunction(searchResults.test.run);
    })
    .finally(function() {
      process.send({ type: 'startedAfterHooks' });
      return runHooks('startedAfterHook', searchResults.after)
        .then(function() {
          process.send({ type: 'finishedAfterHooks' });
        });
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
}

var testInterfacePath = process.argv[2];
var testFile = process.argv[3];
var testPath = process.argv.slice(4);

var testInterface = require(testInterfacePath);
var suite = testInterface(testFile);

runTest(testPath);
