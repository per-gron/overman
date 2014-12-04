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
var EventEmitter = require('events').EventEmitter;
var expect = require('chai').expect;
var stream = require('stream');
var when = require('when');
var OnMessage = require('./util/on_message');
var streamUtil = require('./util/stream');
var shouldFail = require('./util/should_fail');
var TestFailureError = require('../lib/test_failure_error');
var suiteRunner = require('../lib/suite_runner');


function ParallelismCounter() {
  this.maxParallelism = 0;
  this._currentTests = {};
}

ParallelismCounter.prototype.gotMessage = function(testPath, message) {
  var pathAsString = JSON.stringify(testPath);
  if (message.type === 'start') {
    this._currentTests[pathAsString] = true;

    this.maxParallelism = Math.max(this.maxParallelism, _.keys(this._currentTests).length);
  } else if (message.type === 'finish') {
    delete this._currentTests[pathAsString];
  }
};


function listNames(names) {
  return names
    .map(function(name) { return '"' + name + '"'; })
    .join(', ');
}

function runTestSuite(suite, reporters, options) {
  return suiteRunner(_.extend({
      suites: [__dirname + '/suite/' + suite],
      interface: __dirname + '/../lib/interface/bdd_mocha',
      timeout: 500,
      reporters: reporters || []
    }, options));
}

function isTestFailureError(err) {
  return err instanceof TestFailureError;
}

/**
 * A function that takes a test suite and a dictionary from test names to
 * an array of the lines that the given test should print to stdout.
 *
 * Returns a promise that succeeds only if all tests succeed (unless
 * options.allowTestsToFail), only tests that were specified are run and
 * the test output exactly matches the specification.
 */
function ensureOutputFromTests(suite, tests, options) {
  var gotStdioForTests = [];
  var reporters = [];
  var encounteredTests = {};

  var testsPromises = _.keys(tests).map(function(testName) {
    var lines = tests[testName];
    return when.promise(function(resolve, reject) {
      reporters.push(new OnMessage(function(testPath, message) {
        var currentTestName = _.last(testPath.path);
        encounteredTests[currentTestName] = true;

        if (currentTestName === testName && message.type === 'stdio') {
          gotStdioForTests.push(testName);
          streamUtil.waitForStreamToEmitLines(message.stdout, lines)
            .done(resolve, reject);
        }
      }));
    });
  });

  var suitePromise = runTestSuite(suite, reporters, options)
    .catch(function(error) {
      if (!options.allowTestsToFail) {
        throw error;
      }
    })
    .then(function() {
      var testNames = _.keys(tests);
      if (gotStdioForTests.length < testNames.length) {
        var missingTests = _.difference(testNames, gotStdioForTests);

        throw new Error('Did not run all tests (ran ' + listNames(gotStdioForTests) + '. Missing ' + listNames(missingTests) + ')');
      }
    });

  return when.all(testsPromises.concat([suitePromise]))
    .then(function() {
      if (!_.isEqual(_.keys(encounteredTests).sort(), _.keys(tests).sort())) {
        throw new Error('Encountered unexpected tests ' + listNames(_.difference(_.keys(encounteredTests), _.keys(tests))));
      }
    });
}

describe('Suite runner', function() {
  it('should run tests', function() {
    return ensureOutputFromTests('suite_single_successful_test', {
      'should succeed': [ /running_test/ ]
    });
  });

  it('should not run skipped tests', function() {
    return ensureOutputFromTests('suite_single_skipped_test', {});
  });

  it('should run only test that were marked as only', function() {
    return ensureOutputFromTests('suite_only_test_amongst_others', {
      'should be run': [ /should_be_run/ ]
    });
  });

  it('should run only tests that were marked as only', function() {
    return ensureOutputFromTests('suite_only_tests_amongst_others', {
      'should be run': [ /should_be_run/ ],
      'should also be run': [ /should_also_be_run/ ]
    });
  });

  it('should fail if a test fails', function() {
    return shouldFail(runTestSuite('suite_various_tests'), function(error) {
      return isTestFailureError(error) && error.message.match(/failed/);
    });
  });

  it('should fail with TestFailureError if a test has a syntax error', function() {
    return shouldFail(runTestSuite('suite_syntax_error'), isTestFailureError);
  });

  it('should fail when the suite is cancelled', function() {
    var suitePromise = runTestSuite('suite_single_successful_test', [
      new OnMessage(function(testPath, message) {
        if (message.type === 'start') {
          suitePromise.cancel();
        }
      })
    ]);
    return shouldFail(suitePromise, function(error) {
      return isTestFailureError(error) && error.message.match(/cancelled/);
    });
  });

  it('should keep running tests after a test fails', function() {
    return ensureOutputFromTests('suite_two_failing_tests', {
      'should fail 1': [],
      'should fail 2': []
    }, { allowTestsToFail: true });
  });

  it('should cancel tests that time out', function() {
    return shouldFail(runTestSuite('suite_single_test_that_never_finishes'));
  });

  it('should cancel tests that time out because they are in an infinite loop', function() {
    return shouldFail(runTestSuite('suite_single_test_infinite_loop'));
  });

  it('should send SIGINT to tests that time out', function() {
    var deferred = when.defer();

    function fork() {
      var child = new EventEmitter();
      child.stdin = new stream.Readable();

      child.kill = function(signal) {
        expect(signal).to.be.equal('SIGINT');
        child.emit('exit', 0, null);
        child.emit('close');
        deferred.resolve();
      };

      return child;
    }

    return when.all([
      shouldFail(runTestSuite('suite_single_test_that_never_finishes', [], {
        childProcess: { fork: fork },
        timeout: 10
      }), function(error) {
        return (error instanceof TestFailureError) && error.message.match(/Tests failed/);
      }),
      deferred.promise
    ]);
  });

  it('should send SIGKILL to tests that don\'t die after SIGINT', function() {
    var deferred = when.defer();

    function fork() {
      var child = new EventEmitter();
      child.stdin = new stream.Readable();

      child.kill = function(signal) {
        if (signal === 'SIGINT') {
          return; // Ignore SIGINT, wait until we get SIGKILL
        }
        expect(signal).to.be.equal('SIGKILL');
        child.emit('exit', 0, null);
        child.emit('close');
        deferred.resolve();
      };

      return child;
    }

    return when.all([
      shouldFail(runTestSuite('suite_single_test_that_never_finishes', [], {
        childProcess: { fork: fork },
        timeout: 10
      }), function(error) {
        return (error instanceof TestFailureError) && error.message.match(/Tests failed/);
      }),
      deferred.promise
    ]);
  });

  it('should run tests sequentially by default', function() {
    var counter = new ParallelismCounter();
    return runTestSuite('suite_various_tests', [counter])
      .then(function() {}, function() {}) // Discard test result
      .then(function() {
        expect(counter).to.have.property('maxParallelism').that.is.equal(1);
      });
  });

  it('should run tests in parallel', function() {
    var counter = new ParallelismCounter();
    return runTestSuite('suite_various_tests', [counter], { parallelism: 3 })
      .then(function() {}, function() {}) // Discard test result
      .then(function() {
        expect(counter).to.have.property('maxParallelism').that.is.equal(3);
      });
  });

  it('should fail when encountering .only tests and disallow_only is set', function() {
    return shouldFail(runTestSuite('suite_single_only_test', [], { disallow_only: true }));
  });

  it('should run only tests that match the specified match regex', function() {
    return ensureOutputFromTests('suite_various_tests', {
      'should work': [ /should_work/ ],
      'should really work': [ /should_really_work/ ]
    }, { match: /should.*work$/ });
  });

  it('should run only tests that match the specified match string', function() {
    return ensureOutputFromTests('suite_various_tests', {
      'should work': [ /should_work/ ],
      'should really work': [ /should_really_work/ ]
    }, { match: 'work' });
  });

  describe('Timeouts', function() {
    it('should pass timeout to test', function() {
      return ensureOutputFromTests('suite_timeout_print', {
        'should print its timeout': [1337]
      }, { timeout: 1337 });
    });

    it('should let the test set the timeout', function() {
      return when.race([
        shouldFail(runTestSuite('suite_timeout_set', [], { timeout: 2000 })),
        when()
          .delay(500)
          .then(function() {
            throw new Error('Test should have finished by now');
          })
      ]);
    });

    it('should respect listingTimeout', function() {
      return shouldFail(runTestSuite('suite_single_successful_test', [], {
        listingTimeout: 1
      }), function(error) {
        return isTestFailureError(error) && error.message.match(/Timed out while listing tests/);
      });
    });
  });

  describe('Retries', function() {
    function countAttempts(suite, attempts, suiteShouldFail) {
      var retryAttempts = 0;

      var realChildProcess = require('child_process');
      var childProcess = Object.create(realChildProcess);
      childProcess.fork = function() {
        retryAttempts++;
        return realChildProcess.fork.apply(this, arguments);
      };

      var suitePromise = runTestSuite(suite, [], { attempts: attempts, childProcess: childProcess });

      return (suiteShouldFail ? shouldFail(suitePromise, isTestFailureError) : suitePromise)
        .then(function() {
          return retryAttempts;
        });
    }

    it('should retry failed tests', function() {
      return countAttempts('suite_single_failing_test', 3, true)
        .then(function(attempts) {
          expect(attempts).to.be.equal(3);
        });
    });

    it('should not retry successful tests', function() {
      return countAttempts('suite_single_successful_test', 3)
        .then(function(attempts) {
          expect(attempts).to.be.equal(1);
        });
    });
  });

  describe('Slow thresholds', function() {
    it('should pass slow threshold to test', function() {
      return ensureOutputFromTests('suite_slow_print', {
        'should print its slow threshold': [1337]
      }, { slowThreshold: 1337 });
    });
  });
});
