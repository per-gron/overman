'use strict';

var _ = require('underscore');
var childProcess = require('child_process');
var readline = require('readline');
var when = require('when');

function runTest(suite) {
  var testPath = _.toArray(arguments).slice(1);

  return childProcess.fork(
    __dirname + '/../lib/bin/run_test',
    [__dirname + '/../lib/interface/bdd_mocha', __dirname + '/suite/' + suite].concat(testPath),
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

function waitForStreamToEmitLines(stream, linesToWatchFor) {
  return when.promise(function(resolve, reject) {
    var lines = readline.createInterface({ input: stream, output: stream });

    function checkForDone() {
      if (linesToWatchFor.length === 0) {
        resolve();
        lines.close();
        return;
      }
    }

    checkForDone();
    lines.on('line', function(line) {
      if (line.match(linesToWatchFor[0])) {
        linesToWatchFor.shift();
        checkForDone();
      } else {
        reject(new Error('Encountered unexpected line ' + line + ', expected ' + linesToWatchFor[0]));
        lines.close();
      }
    });
  });
}

function waitForStreamToEmitLine(stream, lineToWatchFor) {
  return waitForStreamToEmitLines(stream, [lineToWatchFor]);
}

describe('Test runner', function() {
  it('should run before hooks', function() {
    var process = runTest('suite_before_hook_and_test', 'should succeed');
    return when.all([
      waitForProcessToExit(process),
      waitForStreamToEmitLines(process.stdout, [
        /running_before_hook/,
        /running_test/
      ])
    ]);
  });

  it('should run after hooks', function() {
    var process = runTest('suite_after_hook_and_test', 'should succeed');
    return when.all([
      waitForProcessToExit(process),
      waitForStreamToEmitLines(process.stdout, [
        /running_test/,
        /running_after_hook/
      ])
    ]);
  });

  it('should run before hooks in the order they were specified', function() {
    var process = runTest('suite_before_hooks_and_test', 'should succeed');
    return when.all([
      waitForProcessToExit(process),
      waitForStreamToEmitLines(process.stdout, [
        /running_before_hook_1/,
        /running_before_hook_2/
      ])
    ]);
  });

  it('should run after hooks in the order they were specified', function() {
    var process = runTest('suite_after_hooks_and_test', 'should succeed');
    return when.all([
      waitForProcessToExit(process),
      waitForStreamToEmitLines(process.stdout, [
        /running_after_hook_1/,
        /running_after_hook_2/
      ])
    ]);
  });

  it('should run ancestor suite before hooks before children suite before hooks', function() {
    var process = runTest('suite_before_hooks_in_subsuite', 'Suite', 'should succeed');
    return when.all([
      waitForProcessToExit(process),
      waitForStreamToEmitLines(process.stdout, [
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
      waitForStreamToEmitLines(process.stdout, [
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
      waitForStreamToEmitLines(process.stdout, [
        /running_before_hook/,
        /running_after_hook/
      ])
    ]);
  });

  it('should run after hooks even when test fails', function() {
    var process = runTest('suite_after_hook_and_failing_test', 'should fail');
    return when.all([
      waitForProcessToFail(process),
      waitForStreamToEmitLine(process.stdout, /running_after_hook/)
    ]);
  });

  it('should run tests that don\'t return a promise', function() {
    var process = runTest('suite_single_successful_test', 'should succeed');
    return when.all([
      waitForProcessToExit(process),
      waitForStreamToEmitLine(process.stdout, /running_test/)
    ]);
  });

  it.skip('should run tests that return a promise asynchronously', function() {
  });

  it.skip('should run tests that take a done callback', function() {
  });

  it('should mark tests that throw an exception as failing', function() {
    var process = runTest('suite_single_throwing_test', 'should throw');
    return waitForProcessToFail(process);
  });

  it('should mark tests that return a failed promise as failing', function() {
    var process = runTest('suite_single_failing_test', 'should fail');
    return waitForProcessToFail(process);
  });

  it.skip('should not exit if the test is done but there are still things on the runloop', function() {
  });
});
