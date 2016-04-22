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
 * This file is a node module that exposes functionality to list the tests
 * that a given test suite has. It uses the bin/list_suite script to do this.
 */

var childProcess = require('child_process');

function streamToString(stream) {
  return new Promise(function(resolve) {
    var string = '';
    stream.on('data', function(data) {
      string += data;
    });
    stream.on('end', function() {
      resolve(string);
    });
  });
}

function withTimeout(promise, timeout, onTimeout) {
  // This method may seem more complicated than it has to be. There is one
  // important criteria that it fulfills that I couldn't think of a more concise
  // way to express: The timeout timer must be cancelled as soon as the promise
  // is fulfilled. Otherwise the timer will potentially stay on the runloop for
  // a long time, preventing the suite runner process from exiting.
  if (timeout === 0) {
    return promise;
  } else {
    return new Promise(function(resolve, reject) {
      var timedout = false;
      var timeoutToken = setTimeout(function() {
        timedout = true;
        try {
          resolve(onTimeout());
        } catch (error) {
          reject(error);
        }
      }, timeout);

      function makeDoneCallback(resolveOrReject) {
        return function(value) {
          clearTimeout(timeoutToken);
          if (!timedout) {
            resolveOrReject(value);
          }
        };
      }

      promise.then(
        makeDoneCallback(resolve),
        makeDoneCallback(reject));
    });
  }
}

/**
 * An error "class" that means that an error occured when listing the tests of
 * a suite.
 */
function ListTestError(message, errorOutput) {
  this.message = message;
  this.stack = this.message + (errorOutput ? ':\n' + errorOutput : '');
  this.name = this.constructor.name;
}
ListTestError.prototype = Object.create(Error.prototype);
exports.ListTestError = ListTestError;

function listTestsOfFile(timeout, testInterfacePath, testInterfaceParameter, suite, opt_childProcess) {
  var child = (opt_childProcess || childProcess).fork(
    __dirname + '/bin/list_suite',
    [testInterfacePath, testInterfaceParameter, suite],
    { silent: true });

  var successObjectPromise = streamToString(child.stdout)
    .then(function(string) {
      return JSON.parse(string);
    })
    .catch(function() {});

  var failureErrorPromise = streamToString(child.stderr)
    .then(function(string) {
      return new ListTestError('Failed to process ' + suite, string);
    });

  var resultPromise = new Promise(function(resolve, reject) {
    child.on('exit', function(code) {
      if (code === 0) {
        failureErrorPromise.then(function() {}, function() {});
        successObjectPromise.then(resolve, reject);
      } else {
        successObjectPromise.then(function() {}, function() {});
        failureErrorPromise.then(reject, reject);
      }
    });
  });

  return withTimeout(resultPromise, timeout, function() {
    child.kill('SIGKILL');

    var error = new ListTestError('Timed out while listing tests of ' + suite);
    error.timeout = true;
    throw error;
  });
}
exports.listTestsOfFile = listTestsOfFile;
