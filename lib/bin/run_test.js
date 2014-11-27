/*
 * Copyright 2014 Per Eckerdal
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

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

var _ = require('lodash');
var fn = require('when/function');
var when = require('when');

function sendError(error, extraInformation) {
  process.send(_.extend({
    type: 'error',
    value: error.stack
  }, extraInformation));
}

function invokeFunctionNoErrorHandling(fun) {
  if (fun.length > 0) {
    return when.promise(function(resolve, reject) {
      var callbackCalled = false;
      fun(function(error) {
        if (callbackCalled) {
          sendError({}, {
            value: 'done callback invoked more than once' +
              (error ? ', failing with: ' + error.stack : ', succeeding')
          });
          process.exit(1);
        }

        callbackCalled = true;
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

function invokeFunction(fun, placeInformation) {
  return invokeFunctionNoErrorHandling(fun)
    .catch(function(error) {
      sendError(error, placeInformation);
      throw error;
    });
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

function runHooks(before, hooks) {
  if (hooks.length === 0) {
    return when();
  } else {
    var hook = hooks[0];
    process.send({
      type: before ? 'startedBeforeHook' : 'startedAfterHook',
      name: hook.name
    });
    return invokeFunction(hook.run, {
        in: before ? 'beforeHook' : 'afterHook',
        inName: hook.name
      })
      .then(function() {
        return runHooks(before, hooks.slice(1));
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
      return runHooks(true, searchResults.before);
    })
    .then(function() {
      process.send({ type: 'startedTest' });
      return invokeFunction(searchResults.test.run, { in: 'test' });
    })
    .finally(function() {
      process.send({ type: 'startedAfterHooks' });
      return runHooks(false, searchResults.after)
        .then(function() {
          process.send({ type: 'finishedAfterHooks' });
        });
    })
    .done(function(value) {
      clearInterval(interval);
      // If there are remaining things on the runloop that never finish, we want
      // to exit here, to make sure the test doesn't wait forever.
      process.exit(0);
    }, function(error) {
      process.exit(1);
    });
}

var testInterfacePath = process.argv[2];
var testParameters = JSON.parse(process.argv[3]);
var testTimeout = testParameters.timeout;
var testFile = process.argv[4];
var testPath = process.argv.slice(5);

var testInterface = require(testInterfacePath);
var suite = testInterface(testFile, {
  getTimeout: function() {
    return testTimeout;
  },
  setTimeout: function(newTimeout) {
    testTimeout = newTimeout;
    process.send({ type: 'setTimeout', value: newTimeout });
  }
});

runTest(testPath);
