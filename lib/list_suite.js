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
var when = require('when');

function streamToString(stream) {
  return when.promise(function(resolve) {
    var string = '';
    stream.on('data', function(data) {
      string += data;
    });
    stream.on('end', function() {
      resolve(string);
    });
  });
}

/**
 * An error "class" that means that an error occured when listing the tests of
 * a suite.
 */
function ListTestError(suite, errorOutput) {
  this.message = 'Failed to process ' + suite;
  this.stack = this.message + ':\n' + errorOutput;
  this.name = this.constructor.name;
}
ListTestError.prototype = Object.create(Error.prototype);
exports.ListTestError = ListTestError;

function listTestsOfFile(testInterfacePath, suite) {
  var child = childProcess.fork(
    __dirname + '/bin/list_suite',
    [testInterfacePath, suite],
    { silent: true });

  var successObjectPromise = streamToString(child.stdout)
    .then(function(string) {
      return JSON.parse(string);
    })
    .catch(function() {});

  var failureErrorPromise = streamToString(child.stderr)
    .then(function(string) {
      return new ListTestError(suite, string);
    });

  return when.promise(function(resolve, reject) {
    child.on('exit', function(code) {
      if (code === 0) {
        failureErrorPromise.done();
        successObjectPromise.done(resolve, reject);
      } else {
        successObjectPromise.done(function() {}, function() {});
        failureErrorPromise.done(reject, reject);
      }
    });
  });
}
exports.listTestsOfFile = listTestsOfFile;
