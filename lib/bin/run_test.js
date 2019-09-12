/*
 * Copyright 2014-2016 Per Eckerdal
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
 * Welcome to debugging mode of Overman!
 *
 * When debugging an Overman test, the first thing that happens is that the
 * debugger breaks on this line. The debugger is configured to break at the
 * first line (which is this line), in order to give you a chance to place
 * breakpoints at appropriate places before the test is started.
 *
 * To get started, please locate the source files that are of interest in the
 * "Sources" tab to the left, place breakpoints where appropriate and start the
 * test by clicking the resume button (with an |> icon) to the right.
 */
'use strict';











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

var _ = require('lodash');
var co = require('co');
var exit = require('exit');  // process.exit that works on Windows
var promiseUtil = require('../promise_util');

var testInterfacePath = process.argv[2];
var testParameters = JSON.parse(process.argv[3]);
var testTimeout = testParameters.timeout;
var slowThreshold = testParameters.slowThreshold;
var testInterfaceParameter = testParameters.interfaceParameter;
var killSubProcesses = testParameters.killSubProcesses;
var attributes = testParameters.attributes;
var testFile = process.argv[4];
var testPath = process.argv.slice(5);

var testInterface = require(testInterfacePath);
var cleanup = (function() {
  var cleaned = false;
  return function (exitCode) {
    if (!killSubProcesses) {
      exit(exitCode);
    } else if (cleaned) {
      return;
    }
    cleaned = true;
    require('ps-tree')(process.pid, function (err, children) {
      var childProcesses = children.map(function (p) { return p.PID; });
      childProcesses.forEach(function(pid) {
        if (require('is-running')(pid)) {
          process.kill(pid, 'SIGKILL');
        }
      });
      exit(exitCode);
    });
  };
}());

function sendError(error, extraInformation) {
  process.send(_.assign({
    type: 'error',
    stack: (error && error.stack) || error || 'Unknown error'
  }, extraInformation));
}

// Takes a function that returns either a promise or a generator and
// returns a promise.
function invokeGeneratorOrPromiseFunction(fun) {
  var result;
  try {
    result = fun();
  } catch (e) {
    return Promise.reject(e);
  }

  if (result && result.next) {  // This looks like a generator
    return co(result);
  } else {
    return Promise.resolve(result);
  }
}

function invokeFunctionNoErrorHandling(fun) {
  if (fun.length > 0) {
    return new Promise(function(resolve, reject) {
      var callbackCalled = false;
      fun(function(error) {
        if (callbackCalled) {
          sendError({}, {
            stack: 'done callback invoked more than once' +
              (error ? ', failing with: ' + error.stack : ', succeeding')
          });
          cleanup(1);
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
    return invokeGeneratorOrPromiseFunction(fun);
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
    return Promise.resolve();
  } else {
    var hook = hooks[0];
    process.send({
      type: 'breadcrumb',
      message: 'Starting ' + (before ? 'before' : 'after') + ' hook' + (hook.name ? ' "' + hook.name + '"' : ''),
      systemGenerated: true
    });
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
      }, function(error) {
        if (before) {
          throw error;
        } else {
          // All after hooks should be run always
          return runHooks(before, hooks.slice(1))
            .then(function() {
              // Even though the other hooks succeeded, this one failed
              throw error;
            });
        }
      });
  }
}

/**
 * Takes a function that doesn't take parameters and returns a function that
 * doesn't take parameters that does the same thing, except that it memoizes the
 * result and subsequent calls to it just returns the initial return value.
 */
function doOnce(thunk) {
  var result = null;
  return function() {
    if (thunk) {
      result = thunk();
      thunk = null;
    }
    return result;
  };
}

function runAfterHooks(hooks) {
  process.send({ type: 'startedAfterHooks' });
  return runHooks(false, hooks)
    .then(function() {
      process.send({
        type: 'breadcrumb',
        message: 'Finished running after hooks',
        systemGenerated: true
      });
      process.send({ type: 'finishedAfterHooks' });
    });
}

function makeSureProcessRunsUntilPromiseIsFulfilled(promise) {
  var interval = setInterval(function() {}, 5000);
  return promiseUtil.finally(promise, function() {
    clearInterval(interval);
  });
}

function runTest(foundTest, runAfter) {
  // Make the process not exit(0) if the test returns a promise that never
  // resolves. It would be nice if it was possible to catch this condition here
  // and exit non-zero, but I don't know how to do that, so instead we make
  // sure to time out.
  var testPromise = Promise.resolve()
    .then(function() {
      process.send({ type: 'startedBeforeHooks' });
      return runHooks(true, foundTest.before);
    })
    .then(function() {
      process.send({ type: 'startedTest' });
      process.send({
        type: 'breadcrumb',
        message: 'Starting test',
        systemGenerated: true
      });
      return invokeFunction(foundTest.test.run, { in: 'test' });
    });

  return makeSureProcessRunsUntilPromiseIsFulfilled(
    promiseUtil.finally(testPromise, function() {
      return runAfter();
    }));
}

process.on('uncaughtException', function(error) {
  sendError(error, { in: 'uncaught' });
  cleanup(1);
});

process.on('beforeExit', function(exitCode) {
  cleanup(exitCode);
});

var suite = testInterface(testInterfaceParameter, testFile, {
  attributes: attributes,
  getTimeout: function() {
    return testTimeout;
  },
  setTimeout: function(newTimeout) {
    testTimeout = newTimeout;
    process.send({ type: 'setTimeout', value: newTimeout });
  },
  getSlowThreshold: function() {
    return slowThreshold;
  },
  setSlowThreshold: function(newSlowThreshold) {
    slowThreshold = newSlowThreshold;
    process.send({ type: 'setSlowThreshold', value: newSlowThreshold });
  },
  leaveBreadcrumb: function(message, trace) {
    process.send({ type: 'breadcrumb', message: message, trace: trace });
  },
  emitDebugInfo: function(name, value) {
    process.send({ type: 'debugInfo', name: name, value: value });
  },
  getTitle: function() {
    return testPath;
  }
});

var foundTest = searchForTest(suite, testPath);
var runAfterHooksOnce = doOnce(function() {
  return runAfterHooks(foundTest.after);
});

process.on('message', function(message) {
  function end() {
    cleanup(1);
  }

  if (message.type === 'sigint') {
    runAfterHooksOnce().then(end, end);
  }
});

// Orphan detection
setInterval(function() {
  try {
    process.send({});
  } catch (e) {
    console.warn('Overman has died unexpectedly, cleaning up ' + process.pid);
    cleanup(2);
  }
}, 1000);

runTest(foundTest, runAfterHooksOnce)
  .then(function() {
    // If there are remaining things on the runloop that never finish, we want
    // to exit here, to make sure the test doesn't wait forever.
    cleanup(0);
  }, function() {
    cleanup(1);
  });
