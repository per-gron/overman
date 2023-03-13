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
var async = require('async');
var childProcess = require('child_process');
var expect = require('chai').expect;
var path = require('path');
var listSuite = require('./list_suite');
var softKill = require('./soft_kill').default;
var TimestamperReporter = require('./reporters/timestamper').default;
var CombinedReporter = require('./reporters/combined').default;
var CancellableReporter = require('./reporters/cancellable').default;
var ErrorDetectorReporter = require('./reporters/error_detector');
var SpecReporter = require('./reporters/spec');
var errorMessageUtil = require('./error_message_util');
var TestFailureError = require('./test_failure_error').default;
var TimeoutTimer = require('./timeout_timer').default;

var defaultInterface = __dirname + '/interfaces/bdd_mocha';

/**
 * Types used in this file:
 * * Test path
 * * Suite descriptor
 */

function reportSkippedTest(reporter, testPath, unstable) {
  reporter.gotMessage(testPath, { type: 'start', skipped: true, unstable: unstable });
  reporter.gotMessage(testPath, { type: 'finish', result: 'skipped', unstable: unstable });
}

function hookStream(testPath, stream, reporter, type) {
  stream.on('data', function (data) {
    reporter.gotMessage(testPath, {
      type: type,
      data: data.toString(),
    });
  });
}

function runTestProcess(
  childProcess,
  debugPort,
  timeout,
  slowThreshold,
  reporter,
  testInterfacePath,
  testInterfaceParameter,
  testPath,
  killSubProcesses,
  attributes
) {
  var parameters = {
    timeout: timeout,
    slowThreshold: slowThreshold,
    interfaceParameter: testInterfaceParameter,
    killSubProcesses: killSubProcesses,
    attributes: attributes,
  };
  var debugArgs = debugPort ? ['--inspect-brk=' + debugPort] : [];
  var child = childProcess.fork(
    __dirname + '/bin/run_test',
    [testInterfacePath, JSON.stringify(parameters), testPath.file].concat(testPath.path),
    { silent: true, execArgv: process.execArgv.concat(debugArgs) }
  );

  // might be null in case of listening for debugger
  if (child.stdout && child.stderr) {
    hookStream(testPath, child.stdout, reporter, 'stdout');
    hookStream(testPath, child.stderr, reporter, 'stderr');
  }

  return child;
}

function killAfter(softKill, timeoutTimer, child, timeToWait, graceTime, willKill) {
  var timer = new timeoutTimer(timeToWait);
  timer.on('timeout', function () {
    willKill();
    softKill(child, graceTime);
  });

  child.on('exit', function () {
    timer.cancel();
  });

  child.on('message', function (message) {
    if (message.type === 'setTimeout' && typeof message.value === 'number') {
      timer.updateTimeout(message.value);
    }
  });
}

function runTest(
  softKill,
  timeoutTimer,
  childProcess,
  debugPort,
  timeout,
  graceTime,
  slowThreshold,
  reporter,
  testInterfacePath,
  testInterfaceParameter,
  testPath,
  unstable,
  killSubProcesses,
  attributes
) {
  var didTimeout = false;
  var child = runTestProcess(
    childProcess,
    debugPort,
    timeout,
    slowThreshold,
    reporter,
    testInterfacePath,
    testInterfaceParameter,
    testPath,
    killSubProcesses,
    attributes
  );

  child.on('message', reporter.gotMessage.bind(reporter, testPath));

  if (timeout !== 0) {
    killAfter(softKill, timeoutTimer, child, timeout, graceTime, function () {
      didTimeout = true;
      reporter.gotMessage(testPath, { type: 'timeout' });
    });
  }

  var closePromise = new Promise(function (resolve) {
    child.on('close', function () {
      resolve();
    });
  });

  return new Promise(function (resolve, reject) {
    child.on('exit', function (code, signal) {
      // The 'close' event is typically emitted *after* the 'exit' event. This means
      // that when we get to this point, there may still be outstanding messages in
      // flight from the child process. Because of that, we need to wait for 'close'.
      closePromise.then(function () {
        if (didTimeout) {
          reporter.gotMessage(testPath, { type: 'finish', result: 'timeout', unstable: unstable });
          reject(new Error('Test timed out'));
        } else {
          reporter.gotMessage(testPath, {
            type: 'finish',
            result: code === 0 ? 'success' : 'failure',
            unstable: unstable,
            code: code,
            signal: signal,
          });

          if (code === 0) {
            resolve();
          } else if (signal) {
            reject(new Error('Test process exited with signal ' + signal));
          } else {
            reject(new Error('Test process exited with non-zero exit code ' + code));
          }
        }
      }, reject);
    });
  });
}

function runTestWithRetries(
  softKill,
  timeoutTimer,
  childProcess,
  debugPort,
  timeout,
  graceTime,
  attempts,
  slowThreshold,
  reporter,
  testInterfacePath,
  testInterfaceParameter,
  testPath,
  unstable,
  killSubProcesses,
  attributes
) {
  // When tests are retried, we need to "lie" about the finish message; tests
  // that are retried aren't actually finished, so they should not be reported
  // as such.
  var retryingReporter = Object.create(reporter);
  var postponedFinishMessage = null;
  retryingReporter.gotMessage = function (testPath, message) {
    if (message.type === 'finish') {
      postponedFinishMessage = message;
    } else {
      reporter.gotMessage(testPath, message);
    }
  };
  function sendPostponsedFinishMessage(changeToRetry) {
    expect(postponedFinishMessage).not.to.be.null;
    var message = changeToRetry
      ? _.assign({}, postponedFinishMessage, { type: 'retry' })
      : postponedFinishMessage;
    reporter.gotMessage(testPath, message);
  }

  return runTest(
    softKill,
    timeoutTimer,
    childProcess,
    debugPort,
    timeout,
    graceTime,
    slowThreshold,
    retryingReporter,
    testInterfacePath,
    testInterfaceParameter,
    testPath,
    unstable,
    killSubProcesses,
    attributes
  )
    .then(function () {
      sendPostponsedFinishMessage();
    })
    .catch(function (error) {
      sendPostponsedFinishMessage(attempts > 1);

      if (attempts <= 1) {
        throw error;
      } else {
        return runTestWithRetries(
          softKill,
          timeoutTimer,
          childProcess,
          debugPort,
          timeout,
          graceTime,
          attempts - 1,
          slowThreshold,
          reporter,
          testInterfacePath,
          testInterfaceParameter,
          testPath,
          unstable,
          killSubProcesses,
          attributes
        );
      }
    });
}

function runOrSkipTest(
  softKill,
  timeoutTimer,
  childProcess,
  debugPort,
  attempts,
  globalTimeout,
  graceTime,
  globalSlowThreshold,
  reporter,
  testInterfacePath,
  testInterfaceParameter,
  testDescriptor,
  runUnstable,
  killSubProcesses
) {
  var testPath = testDescriptor.path;
  var testAttributes = testDescriptor.attributes;
  var unstable = !!testDescriptor.unstable;

  if (testDescriptor.skipped || (unstable && !runUnstable)) {
    reportSkippedTest(reporter, testPath, unstable);
    return Promise.resolve();
  } else {
    reporter.gotMessage(testPath, { type: 'start', unstable: unstable });
    if (testAttributes) {
      reporter.gotMessage(testPath, { type: 'attributes', attributes: testAttributes });
    }
    var timeout = 'timeout' in testDescriptor ? testDescriptor.timeout : globalTimeout;
    var slowThreshold = 'slow' in testDescriptor ? testDescriptor.slow : globalSlowThreshold;
    return runTestWithRetries(
      softKill,
      timeoutTimer,
      childProcess,
      debugPort,
      timeout,
      graceTime,
      attempts,
      slowThreshold,
      reporter,
      testInterfacePath,
      testInterfaceParameter,
      testPath,
      unstable,
      killSubProcesses,
      testAttributes
    );
  }
}

/**
 * Takes a list of tests. If none of the tests are marked as "only", then returns
 * the entire list. Otherwise returns only the tests that are marked as "only".
 */
function filterOnly(disallowOnly, tests) {
  var onlyTests = tests.filter(function (test) {
    return test.only;
  });

  if (disallowOnly && onlyTests.length !== 0) {
    throw new Error('Encountered tests marked as .only, and the disallowOnly flag is set');
  }

  return onlyTests.length === 0 ? tests : onlyTests;
}

function filterAttributes(attributeFilter, tests) {
  if (!attributeFilter) {
    return tests;
  }
  return tests.filter(function (test) {
    var attributes = test.attributes || {};
    try {
      return attributeFilter(attributes);
    } catch (error) {
      error.message = 'Encountered error while filtering attributes: ' + error.message;
      throw error;
    }
  });
}

function filterTest(testFilter, tests) {
  if (!testFilter) {
    return tests;
  }
  return tests.filter(function (test) {
    try {
      return testFilter(test);
    } catch (error) {
      error.message = 'Encountered error while filtering tests: ' + error.message;
      throw error;
    }
  });
}

function filterGrep(grep, invertGrep, tests) {
  if (!grep) {
    return tests;
  }

  var possiblyInvert = invertGrep
    ? function (x) {
        return !x;
      }
    : function (x) {
        return x;
      };

  return tests.filter(function (test) {
    return possiblyInvert(test.path.path.join(' ').match(grep));
  });
}

function listTestsOfFiles(timeout, testInterfacePath, testInterfaceParameter, files) {
  return Promise.all(
    files.map(function (file) {
      return listSuite.listTestsOfFile(timeout, testInterfacePath, testInterfaceParameter, file);
    })
  ).then(function (fileTests) {
    return _.flatten(fileTests, true);
  });
}

function listTests(reporter, timeout, testInterfacePath, testInterfaceParameter, files) {
  return listTestsOfFiles(timeout, testInterfacePath, testInterfaceParameter, files).catch(
    function (error) {
      if (!(error instanceof listSuite.ListTestError)) {
        throw error;
      }

      if (reporter.registrationFailed) {
        reporter.registrationFailed(error);
      }
      if (error.timeout) {
        throw new TestFailureError(error.message);
      } else {
        throw new TestFailureError('Failed to process test files', error);
      }
    }
  );
}

function parallelLimit(functions, limit) {
  return new Promise(function (resolve, reject) {
    async.parallelLimit(functions, limit, function (error, value) {
      if (error) {
        reject(error);
      } else {
        resolve(value);
      }
    });
  });
}

/**
 * Run a set of test suites. For information about what options are supported,
 * please refer to the documentation in doc/suite_runner_api.md.
 *
 * Parameters for internal use only:
 * childProcess: Injecting the child_process module for mocking. Optional and only useful for internal testing.
 * timeoutTimer: Injecting the timeout_timer module for mocking. Optional and only useful for internal testing.
 * softKill: Injecting the soft_kill module for mocking. Optional and only useful for internal testing.
 * clock: Injecting a clock for mocking. Should be a function that returns a Date representing the current time. Optional and only useful for internal testing.
 *
 * Returns a promise that succeeds if no tests fail. If one or more tests fail,
 * the promise will fail with a TestFailureError. If the promise fails with any
 * other type of error, it means that there is a bug, for example in a reporter
 * or in the suite runner.
 */
module.exports = function (options) {
  var timeout = _.isNumber(options.timeout) ? options.timeout : 10000;
  var listingTimeout = _.isNumber(options.listingTimeout) ? options.listingTimeout : 60000;
  var slowThreshold = options.slowThreshold || 1000;
  var graceTime = _.isNumber(options.graceTime) ? options.graceTime : 500;
  var attempts = options.attempts || 0;
  var testInterfacePath = path.resolve(options.interface || defaultInterface);
  var testInterfaceParameter = options.interfaceParameter;
  var errorDetector = new ErrorDetectorReporter();
  var clock =
    options.clock ||
    function () {
      return new Date();
    };
  var reporters = options.reporters || [new SpecReporter(process)];
  var internalErrorOutput = options.internalErrorOutput || process.stderr;
  var reporter = new CancellableReporter(
    new TimestamperReporter(new CombinedReporter([errorDetector].concat(reporters)), clock)
  );

  if (!_.isArray(options.files)) {
    throw new Error('Option "files" not present or not Array');
  }

  var resultPromise = listTests(
    reporter,
    listingTimeout,
    testInterfacePath,
    testInterfaceParameter,
    options.files
  )
    .then(filterOnly.bind(this, options.disallowOnly))
    .then(filterAttributes.bind(this, options.attributeFilter))
    .then(filterTest.bind(this, options.testFilter))
    .then(filterGrep.bind(this, options.grep, options.invertGrep))
    .then(function (tests) {
      if (options.debugPort) {
        tests = tests.slice(0, 1); // Only run one test when debugging
      }

      if (!tests.length) {
        throw new Error('No tests found');
      }

      if (reporter.registerTests) {
        reporter.registerTests(
          tests.map(function (test) {
            return test.path;
          }),
          {
            timeout: timeout,
            listingTimeout: listingTimeout,
            slowThreshold: slowThreshold,
            graceTime: graceTime,
            attempts: attempts,
          }
        );
      }

      return parallelLimit(
        tests.map(function (test) {
          return function (done) {
            if (reporter.isFinished()) {
              done(null);
            } else {
              return runOrSkipTest(
                options.softKill || softKill,
                options.timeoutTimer || TimeoutTimer,
                options.childProcess || childProcess,
                options.debugPort,
                attempts,
                timeout,
                graceTime,
                slowThreshold,
                reporter,
                testInterfacePath,
                testInterfaceParameter,
                test,
                options.runUnstable,
                options.killSubProcesses
              ).then(done.bind(this, null), done.bind(this, null));
            }
          };
        }),
        options.parallelism || 8
      );
    })
    .then(function () {
      var cancelled = reporter.isFinished();

      if (reporter.done) {
        reporter.done();
      }

      if (cancelled) {
        throw new TestFailureError('Tests cancelled');
      } else if (errorDetector.didFail()) {
        throw new TestFailureError(
          'Tests failed: testpath: ' +
            JSON.stringify(errorDetector.testPath()) +
            ' message: ' +
            JSON.stringify(errorDetector.message())
        );
      }
    })
    .then(
      function () {},
      function (error) {
        if (!(error instanceof TestFailureError)) {
          // Test failures will already have been reported by reporters, so there
          // is no need for us to report them here.
          internalErrorOutput.write('Internal error in Overman or a reporter:\n');
          internalErrorOutput.write(
            errorMessageUtil.indent(errorMessageUtil.prettyError(error), 2) + '\n'
          );
        }

        throw error;
      }
    );

  resultPromise.cancel = function () {
    if (!reporter.isFinished()) {
      reporter.cancel();
    }
  };

  return resultPromise;
};
