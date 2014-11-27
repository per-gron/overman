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

'use strict';

var _ = require('lodash');
var childProcess = require('child_process');
var expect = require('chai').expect;
var when = require('when');
var stream = require('./util/stream');

function runTest(suite) {
  var testPath = _.toArray(arguments).slice(1);

  var timeout = 1234;  // Not actually used, but needs to be provided
  var parameters = JSON.stringify({ timeout: timeout });
  return childProcess.fork(
    __dirname + '/../lib/bin/run_test',
    [__dirname + '/../lib/interface/bdd_mocha', parameters, __dirname + '/suite/' + suite].concat(testPath),
    { silent: true });
}

function waitForProcessToExit(process) {
  return when.promise(function(resolve, reject) {
    process.on('exit', function(code, signal) {
      if (!signal && code === 0) {
        resolve();
      } else {
        reject(new Error('Process exited with code ' + code + ' (signal ' + signal + ')'));
      }
    });
  });
}

function waitForProcessToFail(process) {
  return when.promise(function(resolve, reject) {
    process.on('exit', function(code, signal) {
      if (!signal && code === 1) {
        resolve();
      } else {
        reject(new Error('Process exited with code ' + code + ' (signal ' + signal + ')'));
      }
    });
  });
}

describe('Test runner', function() {
  it('should run before hooks', function() {
    var process = runTest('suite_before_hook_and_test', 'should succeed');
    return when.all([
      waitForProcessToExit(process),
      stream.waitForStreamToEmitLines(process.stdout, [
        /running_before_hook/,
        /running_test/
      ])
    ]);
  });

  it('should run after hooks', function() {
    var process = runTest('suite_after_hook_and_test', 'should succeed');
    return when.all([
      waitForProcessToExit(process),
      stream.waitForStreamToEmitLines(process.stdout, [
        /running_test/,
        /running_after_hook/
      ])
    ]);
  });

  it('should run before hooks in the order they were specified', function() {
    var process = runTest('suite_before_hooks_and_test', 'should succeed');
    return when.all([
      waitForProcessToExit(process),
      stream.waitForStreamToEmitLines(process.stdout, [
        /running_before_hook_1/,
        /running_before_hook_2/
      ])
    ]);
  });

  it('should run after hooks in the order they were specified', function() {
    var process = runTest('suite_after_hooks_and_test', 'should succeed');
    return when.all([
      waitForProcessToExit(process),
      stream.waitForStreamToEmitLines(process.stdout, [
        /running_after_hook_1/,
        /running_after_hook_2/
      ])
    ]);
  });

  it('should run ancestor suite before hooks before children suite before hooks', function() {
    var process = runTest('suite_before_hooks_in_subsuite', 'Suite', 'should succeed');
    return when.all([
      waitForProcessToExit(process),
      stream.waitForStreamToEmitLines(process.stdout, [
        /running_outer_before_hook/,
        /running_inner_before_hook/,
        /running_test/
      ])
    ]);
  });

  it('should run ancestor suite after hooks after childen suite after hooks', function() {
    var process = runTest('suite_after_hooks_in_subsuite', 'Suite', 'should succeed');
    return when.all([
      waitForProcessToExit(process),
      stream.waitForStreamToEmitLines(process.stdout, [
        /running_test/,
        /running_inner_after_hook/,
        /running_outer_after_hook/
      ])
    ]);
  });

  it('should not run test if before hook fails', function() {
    var process = runTest('suite_failing_before_hook', 'should succeed');
    return when.all([
      waitForProcessToFail(process),
      stream.waitForStreamToEmitLines(process.stdout, [
        /running_before_hook/,
        /running_after_hook/
      ])
    ]);
  });

  it('should run after hooks even when test fails', function() {
    var process = runTest('suite_after_hook_and_failing_test', 'should fail');
    return when.all([
      waitForProcessToFail(process),
      stream.waitForStreamToEmitLines(process.stdout, [
        /running_after_hook/
      ])
    ]);
  });

  it('should run tests that don\'t return a promise', function() {
    var process = runTest('suite_single_successful_test', 'should succeed');
    return when.all([
      waitForProcessToExit(process),
      stream.waitForStreamToEmitLines(process.stdout, [
        /running_test/
      ])
    ]);
  });

  it('should run tests that return a promise asynchronously', function() {
    var process = runTest('suite_test_returning_promise', 'should succeed');
    return when.all([
      waitForProcessToExit(process),
      stream.waitForStreamToEmitLines(process.stdout, [
        /running_test/,
        /still_running_test/,
        /running_after_hook/
      ])
    ]);
  });

  it('should run tests that take a done callback', function() {
    var process = runTest('suite_test_invoking_done', 'should succeed');
    return when.all([
      waitForProcessToExit(process),
      stream.waitForStreamToEmitLines(process.stdout, [
        /running_test/,
        /still_running_test/,
        /running_after_hook/
      ])
    ]);
  });

  it('should fail tests invoke the done with an error', function() {
    var process = runTest('suite_test_invoking_done_with_error', 'should fail');
    return when.all([
      waitForProcessToFail(process),
      stream.waitForStreamToEmitLines(process.stdout, [
        /running_test/,
        /failed_test/
      ])
    ]);
  });

  it('should not let tests call the done callback more than once', function() {
    var process = runTest('suite_test_that_completes_twice', 'should succeed twice');
    return when.all([
      waitForProcessToFail(process),
      when.promise(function(resolve) {
        process.on('message', function(message) {
          if (message.type === 'error' && message.value.match(/done callback invoked more than once/)) {
            resolve();
          }
        });
      })
    ]);
  });

  it('should mark tests that throw an exception as failing', function() {
    var process = runTest('suite_single_throwing_test', 'should throw');
    return waitForProcessToFail(process);
  });

  it('should mark tests that return a failed promise as failing', function() {
    var process = runTest('suite_single_failing_test', 'should fail');
    return waitForProcessToFail(process);
  });

  it('should exit if the test is done but there are still things on the runloop', function() {
    var process = runTest('suite_with_nonempty_runloop', 'should succeed');
    return waitForProcessToExit(process);
  });

  it('should pass test timeout to the interface', function() {
    var process = runTest('suite_timeout_print', 'should print its timeout');
    return when.all([
      waitForProcessToExit(process),
      stream.waitForStreamToEmitLines(process.stdout, [
        /1234/
      ])
    ]);
  });

  it('should emit setTimeout messages when the test asks to change the timeout', function() {
    var process = runTest('suite_timeout_set', 'should set the timeout');
    return when.promise(function(resolve) {
      process.on('message', function(message) {
        if (message.type === 'setTimeout') {
          expect(message).property('value').to.be.equal(10);
          process.kill();
          resolve();
        }
      });
    });
  });
});
