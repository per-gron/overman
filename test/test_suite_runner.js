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

'use strict';

var _ = require('lodash');
var childProcess = require('child_process');
var EventEmitter = require('events').EventEmitter;
var chai = require('chai');
var through = require('through');
var OnMessage = require('./util/on_message');
var streamUtil = require('./util/stream');
var shouldFail = require('./util/should_fail');
var delay = require('./util/delay');
var TestFailureError = require('../dist/test_failure_error');
var suiteRunner = require('../dist/suite_runner');
var promiseUtil = require('../dist/promise_util');
var chaiAsPromised = require('chai-as-promised');

var expect = chai.expect;

chai.use(chaiAsPromised);

function ParallelismCounter() {
  this.maxParallelism = 0;
  this._currentTests = {};
}

ParallelismCounter.prototype.gotMessage = function (testPath, message) {
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
    .map(function (name) {
      return '"' + name + '"';
    })
    .join(', ');
}

function runTestSuite(suite, reporters, options) {
  return suiteRunner(
    _.assign(
      {
        files: [__dirname + '/../test/suite/' + suite],
        timeout: 4000,
        reporters: reporters || [],
        internalErrorOutput: through(),
      },
      options
    )
  );
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
  var gotStartForTests = [];
  var reporters = [];
  var encounteredTests = {};

  var testsPromises = _.keys(tests).map(function (testName) {
    var lines = tests[testName];
    var out = through();

    return new Promise(function (resolve, reject) {
      reporters.push(
        new OnMessage(function (testPath, message) {
          var currentTestName = _.last(testPath.path);
          if (message.type === 'start' && !message.skipped) {
            encounteredTests[currentTestName] = true;
          }

          if (currentTestName === testName) {
            if (message.type === 'start') {
              gotStartForTests.push(testName);

              streamUtil.waitForStreamToEmitLines(out, lines).then(resolve, reject);
            } else if (message.type === 'stdout') {
              out.write(message.data);
            } else if (message.type === 'finish') {
              out.end();
            }
          }
        })
      );
    });
  });

  var suitePromise = runTestSuite(suite, reporters, options)
    .catch(function (error) {
      if (!(options || {}).allowTestsToFail) {
        throw error;
      }
    })
    .then(function () {
      var testNames = _.keys(tests);
      if (gotStartForTests.length < testNames.length) {
        var missingTests = _.difference(testNames, gotStartForTests);

        throw new Error(
          'Did not run all tests (ran ' +
            listNames(gotStartForTests) +
            '. Missing ' +
            listNames(missingTests) +
            ')'
        );
      }
    });

  return Promise.all(testsPromises.concat([suitePromise])).then(function () {
    if (!_.isEqual(_.keys(encounteredTests).sort(), _.keys(tests).sort())) {
      throw new Error(
        'Encountered unexpected tests ' +
          listNames(_.difference(_.keys(encounteredTests), _.keys(tests)))
      );
    }
  });
}

describe('Suite runner', function () {
  it('should require files parameter', function () {
    expect(function () {
      suiteRunner({});
    }).to.throw(/not present or not Array/);
  });

  it('should throw on no test cases', function () {
    return expect(
      suiteRunner({
        files: [],
        internalErrorOutput: through(),
      })
    ).to.be.rejectedWith(/No tests found/);
  });

  it('should run tests', function () {
    return ensureOutputFromTests('suite_single_successful_test', {
      'should succeed': [/running_test/],
    });
  });

  it('should not run skipped tests', function () {
    return ensureOutputFromTests('suite_single_skipped_test', {});
  });

  it('should run only test that were marked as only', function () {
    return ensureOutputFromTests('suite_only_test_amongst_others', {
      'should be run': [/should_be_run/],
    });
  });

  it('should run only tests that were marked as only', function () {
    return ensureOutputFromTests('suite_only_tests_amongst_others', {
      'should be run': [/should_be_run/],
      'should also be run': [/should_also_be_run/],
    });
  });

  it('should run tests that were marked as unstable', function () {
    return ensureOutputFromTests(
      'suite_unstable_tests_amongst_others',
      {
        'should be run': [/should_be_run/],
        'should run if unstable': [/should_run_if_unstable/],
        'should also run if unstable': [/should_also_run_if_unstable/],
        'should also be run': [/should_also_be_run/],
      },
      {
        runUnstable: true,
      }
    );
  });

  it('should not run tests that were marked as unstable', function () {
    return ensureOutputFromTests(
      'suite_unstable_tests_amongst_others',
      {
        'should be run': [/should_be_run/],
        'should also be run': [/should_also_be_run/],
      },
      {
        runUnstable: false,
      }
    );
  });

  it('should fail if a test fails', function () {
    return shouldFail(runTestSuite('suite_various_tests'), function (error) {
      return isTestFailureError(error) && error.message.match(/failed/);
    });
  });

  it('should fail with TestFailureError if a test has a syntax error', function () {
    return shouldFail(runTestSuite('suite_syntax_error'), isTestFailureError);
  });

  it('should not leak things to the runloop', function () {
    return Promise.race([
      delay(2000).then(function () {
        throw new Error('Should be done by now');
      }),
      new Promise(function (resolve, reject) {
        var child = childProcess.fork(__dirname + '/../test/util/run_single_test');

        child.on('exit', function (code) {
          if (code === 0) {
            resolve();
          } else {
            reject(new Error('Process exited with non-zero code ' + code));
          }
        });
      }),
    ]);
  });

  it('should pass killSubProcesses option to test subprocess', function () {
    var killSubProcesses = false;
    var mockChildProcess = {
      fork: function (path, args) {
        killSubProcesses = JSON.parse(args[1]).killSubProcesses;
        return childProcess.fork(path, args);
      },
      on: { on: function () {} },
    };
    return runTestSuite('suite_single_successful_test', [], {
      childProcess: mockChildProcess,
      killSubProcesses: true,
    }).then(function () {
      expect(killSubProcesses).to.be.true;
    });
  });

  it('should emit attributes message for test with attributes', function () {
    var attributes = [];
    var reporter = new OnMessage(function (testPath, message) {
      if (message.type === 'attributes') {
        attributes.push(message.attributes);
      }
    });
    return runTestSuite('suite_attributes', [reporter]).then(function () {
      expect(attributes).to.be.deep.equal([
        { foo: 'baz', bar: 'qux' },
        { foo: 'quux', bar: 'qux' },
      ]);
    });
  });

  describe('Stdio', function () {
    var testSuite = {
      stdout: 'suite_single_successful_test',
      stderr: 'suite_single_successful_test_stderr',
    };

    ['stdout', 'stderr'].forEach(function (streamName) {
      it('should forward ' + streamName + ' data', function () {
        return new Promise(function (resolve) {
          runTestSuite(testSuite[streamName], [
            {
              gotMessage: function (testPath, message) {
                if (message.type === streamName) {
                  expect(message.data).to.be.equal('running_test\n');
                  resolve();
                }
              },
            },
          ]);
        });
      });
    });
  });

  describe('Suite cancellation', function () {
    it('should fail when the suite is cancelled', function () {
      var suitePromise = runTestSuite('suite_single_successful_test', [
        new OnMessage(function (testPath, message) {
          if (message.type === 'start') {
            suitePromise.cancel();
          }
        }),
      ]);
      return shouldFail(suitePromise, function (error) {
        return isTestFailureError(error) && error.message.match(/cancelled/);
      });
    });

    it('should do nothing when cancelled after the suite is done', function () {
      var doneCalledTimes = 0;

      var suitePromise = runTestSuite('suite_single_successful_test', [
        {
          done: function () {
            doneCalledTimes++;
          },
        },
      ]);
      return suitePromise.then(function () {
        expect(doneCalledTimes, 'done should have been called').to.be.equal(1);
        suitePromise.cancel();
        expect(
          doneCalledTimes,
          'done should not be called when cancelling finished suite'
        ).to.be.equal(1);
      });
    });

    it('should do nothing when cancelled subsequent times', function () {
      var doneCalledTimes = 0;

      var suitePromise = runTestSuite('suite_single_successful_test', [
        {
          gotMessage: function (testPath, message) {
            if (message.type === 'start') {
              suitePromise.cancel();
              expect(
                doneCalledTimes,
                'done should be called when cancelling the first time'
              ).to.be.equal(1);
              suitePromise.cancel();
              expect(
                doneCalledTimes,
                'done should not be called when cancelling the second time'
              ).to.be.equal(1);
            }
          },

          done: function () {
            doneCalledTimes++;
          },
        },
      ]);
      return shouldFail(suitePromise, function (error) {
        return isTestFailureError(error) && error.message.match(/cancelled/);
      });
    });
  });

  it('should keep running tests after a test fails', function () {
    return ensureOutputFromTests(
      'suite_two_failing_tests',
      {
        'should fail 1': [],
        'should fail 2': [],
      },
      { allowTestsToFail: true }
    );
  });

  it('should cancel tests that time out', function () {
    return shouldFail(runTestSuite('suite_single_test_that_never_finishes'));
  });

  it('should cancel tests that time out because they are in an infinite loop', function () {
    return shouldFail(runTestSuite('suite_single_test_infinite_loop'));
  });

  it('should run tests in parallel by default', function () {
    var counter = new ParallelismCounter();
    return runTestSuite('suite_various_tests', [counter])
      .then(
        function () {},
        function () {}
      ) // Discard test result
      .then(function () {
        expect(counter).to.have.property('maxParallelism').that.is.gt(3);
      });
  });

  it('should run tests sequentially', function () {
    var counter = new ParallelismCounter();
    return runTestSuite('suite_various_tests', [counter], { parallelism: 1 })
      .then(
        function () {},
        function () {}
      ) // Discard test result
      .then(function () {
        expect(counter).to.have.property('maxParallelism').that.is.equal(1);
      });
  });

  it('should run tests in parallel', function () {
    var counter = new ParallelismCounter();
    return runTestSuite('suite_various_tests', [counter], { parallelism: 3 })
      .then(
        function () {},
        function () {}
      ) // Discard test result
      .then(function () {
        expect(counter).to.have.property('maxParallelism').that.is.equal(3);
      });
  });

  it('should fail when encountering .only tests and disallowOnly is set', function () {
    return shouldFail(runTestSuite('suite_single_only_test', [], { disallowOnly: true }));
  });

  it('should detect and kill orphan childprocess', function () {
    var proc = require('child_process').fork('test/util/run_single_test_that_never_finishes.js');
    return Promise.resolve(
      new Promise(function (resolve) {
        var timeout = setInterval(function () {
          require('ps-tree')(process.pid, function (err, children) {
            var childrenPID = children
              .filter(function (p) {
                // command key is different on linux/windows
                var command = p.COMMAND ? p.COMMAND : p.COMM;
                return command.includes('node');
              })
              .map(function (p) {
                return p.PID;
              });
            if (childrenPID.length === 2) {
              proc.kill('SIGKILL');
              clearInterval(timeout);
              resolve(childrenPID);
            }
          });
        }, 300);
      }).then(function (childrenPID) {
        return new Promise(function (resolve) {
          setInterval(function () {
            var livingChildProcesses = [];
            childrenPID.forEach(function (childPID) {
              if (require('is-running')(childPID)) {
                livingChildProcesses.push(childPID);
              }
            });
            livingChildProcesses.length === 0 && resolve();
          }, 300);
        });
      })
    );
  });

  describe('Attribute filter', function () {
    it('should run only tests that passes the attribute filter function', function () {
      return ensureOutputFromTests(
        'suite_attributes',
        {
          'should override': [],
        },
        {
          attributeFilter: function (attributes) {
            return attributes.foo === 'baz';
          },
        }
      );
    });

    it('should emit error for attribute filter which throws', function () {
      function attributeFilter() {
        throw new Error('client error');
      }
      var suitePromise = runTestSuite('suite_attributes', [], { attributeFilter: attributeFilter });
      return shouldFail(suitePromise, function (error) {
        return error.message.match(/^Encountered error while filtering attributes/);
      });
    });
  });

  describe('Test filter', function () {
    it('should run only tests that passes the filter function', function () {
      return ensureOutputFromTests(
        'suite_attributes',
        {
          'should override': [],
        },
        {
          testFilter: function (test) {
            return test.attributes.foo === 'baz';
          },
        }
      );
    });

    it('should emit error for test filter which throws', function () {
      function testFilter() {
        throw new Error('client error');
      }
      var suitePromise = runTestSuite('suite_attributes', [], { testFilter: testFilter });
      return shouldFail(suitePromise, function (error) {
        return error.message.match(/^Encountered error while filtering tests/);
      });
    });
  });

  describe('Grep', function () {
    it('should run only tests that match the specified grep regex', function () {
      return ensureOutputFromTests(
        'suite_various_tests',
        {
          'should work': [/should_work/],
          'should really work': [/should_really_work/],
        },
        { grep: /should.*work$/ }
      );
    });

    it('should run only tests that match the specified grep string', function () {
      return ensureOutputFromTests(
        'suite_various_tests',
        {
          'should work': [/should_work/],
          'should really work': [/should_really_work/],
        },
        { grep: 'work' }
      );
    });

    it('should not run tests that match inverted grep regex', function () {
      return ensureOutputFromTests(
        'suite_various_tests',
        {
          'should be awesome': [],
        },
        { grep: /Something/, invertGrep: true }
      );
    });

    it('should not run tests that match inverted grep string', function () {
      return ensureOutputFromTests(
        'suite_various_tests',
        {
          'should be awesome': [],
        },
        { grep: 'Something', invertGrep: true }
      );
    });
  });

  it('should print internal error information to the internalErrorOutput stream', function () {
    var out = streamUtil.stripAnsiStream();

    var streamOutput = streamUtil.waitForStreamToEmitLines(out, [
      /Internal error in Overman or a reporter:/,
      /Test/,
      /stack/,
      /.*/,
    ]);

    var error = new Error('Test');
    error.stack = 'Test\nstack';

    var suitePromise = suiteRunner({
      files: [__dirname + '/../test/suite/suite_test_title'],
      reporters: [
        {
          registerTests: function () {
            throw error;
          },
        },
      ],
      internalErrorOutput: out,
    });

    var expectFailure = shouldFail(suitePromise, function (raisedError) {
      return raisedError === error;
    });

    return Promise.all([
      streamOutput,
      promiseUtil.finally(expectFailure, function () {
        out.end();
      }),
    ]);
  });

  describe('Timeouts', function () {
    it('should pass timeout to test', function () {
      return ensureOutputFromTests(
        'suite_timeout_print',
        {
          'should print its timeout': [1337],
        },
        { timeout: 1337 }
      );
    });

    it('should let the test set the timeout', function () {
      return Promise.race([
        shouldFail(runTestSuite('suite_timeout_set', [], { timeout: 2000 })),
        delay(1500).then(function () {
          throw new Error('Test should have finished by now');
        }),
      ]);
    });

    it('should respect per test timeout overrides', function () {
      return ensureOutputFromTests('suite_timeout_set_in_suite', {
        'should print its timeout': [1234],
      });
    });

    it('should respect listingTimeout', function () {
      return shouldFail(
        runTestSuite('suite_single_successful_test', [], {
          listingTimeout: 1,
        }),
        function (error) {
          return isTestFailureError(error) && error.message.match(/Timed out while listing tests/);
        }
      );
    });

    it('should treat 0 listingTimeout as no listing timeout', function () {
      return runTestSuite('suite_single_successful_test', [], {
        listingTimeout: 0,
        reporters: [
          {
            registerTests: function (tests, parameters) {
              expect(parameters).property('listingTimeout').to.be.equal(0);
            },
          },
        ],
      });
    });

    it("should send 'sigint' message to tests that time out", function () {
      let deferredResolve;
      const deferredPromise = new Promise((resolve) => (deferredResolve = resolve));

      function fork() {
        var child = new EventEmitter();
        child.stdout = { on: function () {} };
        child.stderr = { on: function () {} };

        child.kill = function () {};
        child.send = function (message) {
          expect(message).property('type').to.be.equal('sigint');
          child.emit('exit', 0, null);
          child.emit('close');
          deferredResolve();
        };

        return child;
      }

      return Promise.all([
        shouldFail(
          runTestSuite('suite_single_test_that_never_finishes', [], {
            childProcess: { fork: fork },
            timeout: 10,
          }),
          function (error) {
            return error instanceof TestFailureError && error.message.match(/Tests failed/);
          }
        ),
        deferredPromise,
      ]);
    });

    it('should suppress all messages from a test process after it times out', function () {
      var lastMessage = null;
      var didTimeout = false;

      function fork() {
        var child = new EventEmitter();
        child.stdout = { on: function () {} };
        child.stderr = { on: function () {} };

        child.kill = function () {};
        child.send = function (message) {
          expect(message).property('type').to.be.equal('sigint');
          child.emit('message', { type: 'debugInfo', name: 'a', value: 'should be suppressed' });
          child.emit('exit', 0, null);
          child.emit('close');
          didTimeout = true;
        };

        return child;
      }

      return shouldFail(
        runTestSuite('suite_single_test_that_never_finishes', [], {
          childProcess: { fork: fork },
          timeout: 10,
          reporters: [
            new OnMessage(function (path, message) {
              lastMessage = message;
            }),
          ],
        }),
        function (error) {
          return error instanceof TestFailureError && error.message.match(/Tests failed/);
        }
      ).then(function () {
        expect(didTimeout, "The test wasn't run as expected").to.be.true;
        expect(lastMessage, 'Finish should be the last message sent').to.be.deep.equal({
          type: 'finish',
          result: 'timeout',
          unstable: false,
        });
      });
    });

    it("should send SIGKILL to tests that don't die after 'sigint' message", function () {
      let deferredResolve;
      const deferredPromise = new Promise((resolve) => (deferredResolve = resolve));

      function fork() {
        var child = new EventEmitter();
        child.stdout = { on: function () {} };
        child.stderr = { on: function () {} };

        child.kill = function (signal) {
          expect(signal).to.be.equal('SIGKILL');
          child.emit('exit', 0, null);
          child.emit('close');
          deferredResolve();
        };
        child.send = function () {};

        return child;
      }

      return Promise.all([
        shouldFail(
          runTestSuite('suite_single_test_that_never_finishes', [], {
            childProcess: { fork: fork },
            timeout: 10,
          }),
          function (error) {
            return error instanceof TestFailureError && error.message.match(/Tests failed/);
          }
        ),
        deferredPromise,
      ]);
    });

    [0, 1234].forEach(function (graceTime) {
      it('should respect the graceTime parameter of ' + graceTime, function () {
        let softKillResolve;
        const softKillPromise = new Promise((resolve) => (softKillResolve = resolve));

        function softKill(process, timeout) {
          process.kill('SIGKILL');
          expect(timeout).to.be.equal(graceTime);
          softKillResolve();
        }

        var suitePromise = shouldFail(
          runTestSuite('suite_single_successful_test', [], {
            timeout: 1,
            graceTime: graceTime,
            softKill: softKill,
          }),
          function (error) {
            return error instanceof TestFailureError;
          }
        );

        return Promise.all([softKillPromise, suitePromise]);
      });
    });

    it('should treat timeout of 0 as no timeout', function () {
      return runTestSuite('suite_single_successful_test', [], {
        timeout: 0,
        timeoutTimer: function () {
          throw new Error('No TimeoutTimer should be instantiated when timeout is 0');
        },
      });
    });
  });

  describe('Retries', function () {
    function countAttempts(suite, attempts, suiteShouldFail, opt_options) {
      var retryAttempts = 0;

      var realFork = (opt_options || {}).fork || require('child_process').fork;
      function fork() {
        retryAttempts++;
        return realFork.apply(this, arguments);
      }

      var suitePromise = runTestSuite(suite, [], {
        attempts: attempts,
        childProcess: { fork: fork },
        timeout: (opt_options || {}).timeout,
      });

      return (suiteShouldFail ? shouldFail(suitePromise, isTestFailureError) : suitePromise).then(
        function () {
          return retryAttempts;
        }
      );
    }

    it('should retry failed tests', function () {
      return countAttempts('suite_single_failing_test', 3, true).then(function (attempts) {
        expect(attempts).to.be.equal(3);
      });
    });

    it('should not retry successful tests', function () {
      return countAttempts('suite_single_successful_test', 3).then(function (attempts) {
        expect(attempts).to.be.equal(1);
      });
    });

    it('should retry tests that time out even when the test process exits with a 0 exit code', function () {
      function fork() {
        var child = new EventEmitter();
        child.stdout = { on: function () {} };
        child.stderr = { on: function () {} };

        child.send = function (message) {
          expect(message).property('type').to.be.equal('sigint');
          child.emit('exit', 0, null);
          child.emit('close');
        };

        return child;
      }

      return countAttempts('suite_single_successful_test', 2, true, {
        timeout: 10,
        fork: fork,
      }).then(function (attempts) {
        expect(attempts).to.be.equal(2);
      });
    });
  });

  describe('Slow thresholds', function () {
    it('should pass slow threshold to test', function () {
      return ensureOutputFromTests(
        'suite_slow_print',
        {
          'should print its slow threshold': [1337],
        },
        { slowThreshold: 1337 }
      );
    });

    it('should respect per test slow threshold overrides', function () {
      return ensureOutputFromTests('suite_slow_set_in_suite', {
        'should print its slowness threshold': [1234],
      });
    });
  });

  describe('Interface parameter', function () {
    it('should pass interface parameter to interface', function () {
      return ensureOutputFromTests(
        'suite_single_successful_test',
        {
          interface_param: ['param: "interface_param"'],
        },
        {
          interface: __dirname + '/../test/util/dummy_parameterized_interface',
          interfaceParameter: 'interface_param',
        }
      );
    });
  });

  describe('Debug', function () {
    it('should run only one test when debugPort is specified', function () {
      var suiteTests = [];
      var tests = runTestSuite('suite_two_passing_tests', [], {
        reporters: [
          {
            registerTests: function (tests) {
              suiteTests = tests;
            },
          },
        ],
        debugPort: 1234,
      }).then(
        function () {},
        function () {}
      );

      return tests.then(function () {
        expect(suiteTests.length).to.be.equal(1);
      });
    });

    function extractSubprocessForkOptions(options) {
      return new Promise(function (resolve, reject) {
        var mockChildProcess = {
          fork: function (path, args, options) {
            resolve(options);
          },
        };
        runTestSuite(
          'suite_single_successful_test',
          [],
          _.assign(
            {
              childProcess: mockChildProcess,
            },
            options
          )
        ).then(function () {}, reject);
      });
    }

    it('should pass debug option to test subprocess', function () {
      return extractSubprocessForkOptions({ debugPort: 1234 }).then(function (options) {
        expect(options).property('execArgv').to.be.deep.equal(['--inspect-brk=1234']);
      });
    });

    it('should not pass debug option to test subprocess when debugPort is not set', function () {
      return extractSubprocessForkOptions({}).then(function (options) {
        expect(options).property('execArgv').to.be.deep.equal([]);
      });
    });
  });
  describe('Members in currentTest', function () {
    it('should include title and full title', function () {
      return ensureOutputFromTests('suite_test_title_in_tests', {
        'should succeed 1': [/should succeed 1/, /Suite:should succeed 1/],
        'should succeed 2': [/should succeed 2/, /Suite:should succeed 2/],
      });
    });
  });
});
