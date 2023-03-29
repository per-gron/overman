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
 * Test suite that verifies that reporters get the messages they're supposed to
 * get.
 */

import { expect } from 'chai';
import * as path from 'path';
import OnMessage from './util/on_message';
import shouldFail from './util/should_fail';
import makeFakeClock from './util/fake_clock';
import TestFailureError from '../test_failure_error';
import suiteRunner, { Options } from '../suite_runner';
import { TestPath } from '../test_path';
import { Message } from '../reporters/message';
import { FakeProcess } from '../fakes/fake_process_like';
import Reporter from '../reporters/reporter';

function pathForSuite(suite: string) {
  return path.resolve(`${__dirname}/../../data/suite/${suite}`);
}

function runTestSuite(suite: string, reporter?: Reporter, options?: Partial<Options>) {
  return suiteRunner({
    files: [pathForSuite(suite)],
    timeout: 4000,
    reporters: reporter ? [reporter] : [],
    ...options,
  });
}

type MessagePredicate = (_1: TestPath, _2: Message, ...args: unknown[]) => boolean | void | unknown;

/**
 * Runs the given test suite and listens to the messages from the run.
 *
 * Returns a promise that succeeds if there was a message that matched
 * each predicate, in order. It succeeds even if the test itself fails,
 * and also if there are non-matching messages in between the matching
 * ones.
 */
function ensureMessages(
  suite: string,
  predicates: MessagePredicate[],
  options?: Partial<Options> & { requireAll?: boolean }
) {
  return new Promise<void>((resolve, reject) => {
    let failed = false;

    const reporter = new OnMessage((testPath, message) => {
      try {
        if (predicates.length !== 0) {
          predicates[0](testPath, message);
          predicates.shift();
        }
      } catch (error) {
        if ((options || {}).requireAll) {
          if (!failed) {
            failed = true;
            reject(error);
          }
        }
      }
    });

    function finish() {
      if (failed) {
        return;
      }

      if (predicates.length === 0) {
        resolve();
      } else {
        reject(new Error(`Did not get expected message (${predicates.length} remaining)`));
      }
    }

    runTestSuite(suite, reporter, options)
      .catch(() => {})
      .finally(finish);
  });
}

function ensureAllMessages(
  suite: string,
  predicate: MessagePredicate,
  options?: Partial<Options> & { shouldFail?: boolean }
) {
  return new Promise<void>((resolve, reject) => {
    const reporter = new OnMessage((testPath, message, ...args) => {
      if (!predicate(testPath, message, ...args)) {
        reject(new Error('Encountered unexpected message from skipped test: ' + message.type));
      }
    });

    let suitePromise = runTestSuite(suite, reporter, options);

    if (options?.shouldFail) {
      suitePromise = shouldFail(suitePromise) as typeof suitePromise;
    }

    suitePromise.then(resolve, reject);
  });
}

describe('Reporter API', async function () {
  it('should invoke registerTests with a list of the tests about to be run', function () {
    let deferredResolve: () => void;
    const deferredPromise = new Promise<void>((resolve) => (deferredResolve = resolve));

    const testSuitePromise = runTestSuite('suite_single_successful_test', {
      registerTests(tests) {
        expect(tests).to.be.deep.equal([
          { file: pathForSuite('suite_single_successful_test'), path: ['should succeed'] },
        ]);
        deferredResolve();
      },
    });
    return Promise.all([testSuitePromise, deferredPromise]);
  });

  it('should invoke registerTests with suite runner options', function () {
    let deferredResolve: () => void;
    const deferredPromise = new Promise<void>((resolve) => (deferredResolve = resolve));

    const inOptions = {
      timeout: 9000, // Timeout needs to be adequately long
      listingTimeout: 60000,
      slowThreshold: 345,
      graceTime: 456,
      attempts: 567,
    };

    const testSuitePromise = runTestSuite(
      'suite_single_successful_test',
      {
        registerTests(_, options) {
          expect(options).to.be.deep.equal(inOptions);
          deferredResolve();
        },
      },
      inOptions
    );
    return Promise.all([testSuitePromise, deferredPromise]);
  });

  it('should invoke registerTests with default suite runner options', function () {
    let deferredResolve: () => void;
    const deferredPromise = new Promise<void>((resolve) => (deferredResolve = resolve));

    const testSuitePromise = runTestSuite('suite_single_successful_test', {
      registerTests(_, options) {
        expect(options).property('timeout').to.be.a('number');
        expect(options).property('listingTimeout').to.be.a('number');
        expect(options).property('slowThreshold').to.be.a('number');
        expect(options).property('graceTime').to.be.a('number');
        expect(options).property('attempts').to.be.a('number');
        deferredResolve();
      },
    });
    return Promise.all([testSuitePromise, deferredPromise]);
  });

  it('should invoke registerTests with wall time by default', function () {
    let deferredResolve: () => void;
    const deferredPromise = new Promise<void>((resolve) => (deferredResolve = resolve));

    const testSuitePromise = runTestSuite('suite_single_successful_test', {
      registerTests(_tests, _options, time) {
        expect(time.getTime() - new Date().getTime()).to.be.within(-150, 150);
        deferredResolve();
      },
    });
    return Promise.all([testSuitePromise, deferredPromise]);
  });

  it('should invoke registerTests with current time', function () {
    const { clock } = makeFakeClock();
    let deferredResolve: () => void;
    const deferredPromise = new Promise<void>((resolve) => (deferredResolve = resolve));

    const testSuitePromise = runTestSuite(
      'suite_single_successful_test',
      {
        registerTests: function (tests, options, time) {
          expect(time).to.be.deep.equal(clock());
          deferredResolve();
        },
      },
      { clock: clock }
    );
    return Promise.all([testSuitePromise, deferredPromise]);
  });

  it('should emit messages with current time', function () {
    const { clock, step } = makeFakeClock();

    return ensureAllMessages(
      'suite_various_tests',
      function (testPath, message, time) {
        expect(time).to.be.deep.equal(clock());
        step(1);
        return true;
      },
      { clock: clock, shouldFail: true }
    );
  });

  it('should emit start message', function () {
    return ensureMessages('suite_single_successful_test', [
      function (testPath, message) {
        expect(message).property('type').to.be.equal('start');
      },
    ]);
  });

  it('should emit stdout message', function () {
    return ensureMessages('suite_single_successful_test', [
      function (testPath, message) {
        expect(message).property('type').to.be.equal('stdout');
        expect(message).property('data').to.exist;
      },
    ]);
  });

  it('should emit stderr message', function () {
    return ensureMessages('suite_single_successful_test_stderr', [
      function (testPath, message) {
        expect(message).property('type').to.be.equal('stderr');
        expect(message).property('data').to.exist;
      },
    ]);
  });

  it('should emit startedBeforeHooks message', function () {
    return ensureMessages('suite_single_successful_test', [
      function (testPath, message) {
        expect(message).property('type').to.be.equal('startedBeforeHooks');
      },
    ]);
  });

  it('should emit startedBeforeHook message', function () {
    return ensureMessages('suite_test_with_named_before_hook', [
      function (testPath, message) {
        expect(message).property('type').to.be.equal('startedBeforeHook');
        expect(message).property('name').to.be.equal('beforeHookName');
      },
    ]);
  });

  it('should emit startedTest message', function () {
    return ensureMessages('suite_single_successful_test', [
      function (testPath, message) {
        expect(message).property('type').to.be.equal('startedTest');
      },
    ]);
  });

  it('should emit startedAfterHooks message', function () {
    return ensureMessages('suite_single_successful_test', [
      function (testPath, message) {
        expect(message).property('type').to.be.equal('startedAfterHooks');
      },
    ]);
  });

  it('should emit startedAfterHook message', function () {
    return ensureMessages('suite_test_with_named_after_hook', [
      function (testPath, message) {
        expect(message).property('type').to.be.equal('startedAfterHook');
        expect(message).property('name').to.be.equal('afterHookName');
      },
    ]);
  });

  it('should emit finishedAfterHooks message', function () {
    return ensureMessages('suite_single_successful_test', [
      function (testPath, message) {
        expect(message).property('type').to.be.equal('finishedAfterHooks');
      },
    ]);
  });

  it('should not emit finishedAfterHooks message when after hook never finishes', function () {
    return ensureAllMessages(
      'suite_after_hook_that_never_finishes',
      function (testPath, message) {
        return message.type !== 'finishedAfterHooks';
      },
      { shouldFail: true }
    );
  });

  it('should emit finish message for successful test', function () {
    return ensureMessages('suite_single_successful_test', [
      function (testPath, message) {
        expect(message).property('type').to.be.equal('finish');
        expect(message).property('result').to.be.equal('success');
        expect(message).property('code').to.be.equal(0);
      },
    ]);
  });

  it('should emit finish message for successful test when attempts > 1', function () {
    return ensureMessages(
      'suite_single_successful_test',
      [
        function (testPath, message) {
          expect(message).property('type').to.be.equal('finish');
          expect(message).property('result').to.be.equal('success');
          expect(message).property('code').to.be.equal(0);
        },
      ],
      { attempts: 2 }
    );
  });

  it('should emit finish message for failing test', function () {
    return ensureMessages('suite_single_throwing_test', [
      function (testPath, message) {
        expect(message).property('type').to.be.equal('finish');
        expect(message).property('result').to.be.equal('failure');
        expect(message).property('code').to.be.equal(1);
      },
    ]);
  });

  it('should emit start message with skipped marker for skipped test', function () {
    return ensureMessages('suite_single_skipped_test', [
      function (testPath, message) {
        expect(message).property('type').to.be.equal('start');
        expect(message).property('skipped').to.be.equal(true);
      },
    ]);
  });

  it('should emit finish message for skipped test', function () {
    return ensureMessages('suite_single_skipped_test', [
      function (testPath, message) {
        expect(message).property('type').to.be.equal('finish');
        expect(message).property('result').to.be.equal('skipped');
      },
    ]);
  });

  describe('Timeouts', function () {
    it('should emit timeout message for test that times out', function () {
      return ensureMessages(
        'suite_single_test_that_never_finishes',
        [
          function (testPath, message) {
            expect(message).property('type').to.be.equal('timeout');
          },
        ],
        { timeout: 1 }
      );
    });

    it('should emit finish message for test that times out', function () {
      return ensureMessages(
        'suite_single_test_that_never_finishes',
        [
          function (testPath, message) {
            expect(message).property('type').to.be.equal('finish');
            expect(message).property('result').to.be.equal('timeout');
          },
        ],
        { timeout: 1 }
      );
    });

    it('should emit reporter messages even after the test times out', function () {
      return ensureMessages(
        'suite_single_test_that_never_finishes_with_after_hook',
        [
          function (testPath, message) {
            expect(message).property('type').to.be.equal('debugInfo');
            expect(message).property('name').to.be.equal('in');
            expect(message).property('value').to.be.equal('afterHook');
          },
        ],
        { timeout: 1 }
      );
    });

    it('should emit messages in the right order when test times out', function () {
      return ensureMessages(
        'suite_single_test_that_never_finishes_with_after_hook',
        [
          function (testPath, message) {
            expect(message).property('type').to.be.equal('timeout');
          },
          function (testPath, message) {
            expect(message).property('type').to.be.equal('debugInfo');
          },
          function (testPath, message) {
            expect(message).property('type').to.be.equal('finish');
          },
        ],
        { timeout: 1 }
      );
    });
  });

  it('should emit only start and finish message for skipped test', function () {
    return ensureAllMessages('suite_single_skipped_test', function (testPath, message) {
      return message.type === 'start' || message.type === 'finish';
    });
  });

  it('should emit finish message last, even when messages arrive after process exit', function () {
    class Child extends FakeProcess {
      constructor() {
        super();
        process.nextTick(() => {
          this.emit('exit', 0, null);
          this.emit('message', { type: 'testMessage' });
          this.emit('close');
        });
      }
    }
    const fork = () => new Child();

    return ensureMessages(
      'suite_single_test_that_never_finishes',
      [
        (_, message) => expect(message).property('type').to.be.equal('start'),
        (_, message) => expect(message).property('type').to.be.equal('testMessage'),
        (_, message) => expect(message).property('type').to.be.equal('finish'),
      ],
      { childProcess: { fork } }
    );
  });

  it('should emit retry message when a test is retried', function () {
    const messages = [
      'start',
      'startedBeforeHooks',
      'startedTest',
      'breadcrumb',
      'error',
      'startedAfterHooks',
      'breadcrumb',
      'finishedAfterHooks',
      'retry',
      'startedBeforeHooks',
      'startedTest',
      'breadcrumb',
      'error',
      'startedAfterHooks',
      'breadcrumb',
      'finishedAfterHooks',
      'finish',
    ];

    return ensureMessages(
      'suite_single_failing_test',
      messages.map(function (type) {
        return function (testPath, message) {
          expect(message).property('type').to.be.equal(type);
        };
      }),
      {
        attempts: 2,
        requireAll: true,
      }
    );
  });

  it('should emit messages with a correct test path', function () {
    const suite = 'suite_single_skipped_test';
    return ensureAllMessages(suite, function (testPath) {
      return testPath.file === pathForSuite(suite);
    });
  });

  it('should emit error message when before hook fails', function () {
    return ensureMessages('suite_failing_before_hook', [
      function (testPath, message) {
        expect(message).property('type').to.be.equal('error');
        expect(message).property('in').to.be.equal('beforeHook');
        expect(message).property('inName').to.be.equal('before hook');
      },
    ]);
  });

  it('should emit error message when test fails', function () {
    return ensureMessages('suite_single_throwing_test', [
      function (testPath, message) {
        expect(message).property('type').to.be.equal('error');
        expect(message).property('in').to.be.equal('test');
      },
    ]);
  });

  it('should emit error message when test fails with an uncaught exception', function () {
    return ensureMessages('suite_single_test_uncaught_exception', [
      function (testPath, message) {
        expect(message).property('type').to.be.equal('error');
        expect(message).property('in').to.be.equal('uncaught');
      },
    ]);
  });

  it('should emit error message when after hook fails', function () {
    return ensureMessages('suite_failing_after_hook', [
      function (testPath, message) {
        expect(message).property('type').to.be.equal('error');
        expect(message).property('in').to.be.equal('afterHook');
        expect(message).property('inName').to.be.equal('after hook');
      },
    ]);
  });

  it('should report errors from both the test and after hook when both fail', function () {
    return ensureMessages('suite_failing_after_hook_and_failing_test', [
      function (testPath, message) {
        expect(message).property('type').to.be.equal('error');
        expect(message).property('in').to.be.equal('test');
      },
      function (testPath, message) {
        expect(message).property('type').to.be.equal('error');
        expect(message).property('in').to.be.equal('afterHook');
        expect(message).property('inName').to.be.equal('after hook');
      },
    ]);
  });

  it('should report syntax errors', function () {
    let deferredResolve = () => {};
    const deferredPromise = new Promise<void>((resolve) => (deferredResolve = resolve));

    const testSuitePromise = runTestSuite('suite_syntax_error', {
      registrationFailed: function (error) {
        expect(error)
          .property('message')
          .to.match(/Failed to process .*suite_syntax_error/);
        expect(error)
          .property('stack')
          .to.match(/SyntaxError: Unexpected identifier/);
        deferredResolve();
      },
    });

    return Promise.all([
      shouldFail(testSuitePromise, function (err) {
        return err instanceof TestFailureError;
      }),
      deferredPromise,
    ]);
  });

  it('should emit an aborted finish message when suite is cancelled while the test is running', function () {
    let deferredResolve = () => {};
    const deferredPromise = new Promise<void>((resolve) => (deferredResolve = resolve));
    const abortController = new AbortController();
    const suitePromise = runTestSuite(
      'suite_single_successful_test',
      new OnMessage(function (testPath, message) {
        if (message.type === 'start') {
          abortController.abort();
        } else if (message.type === 'finish') {
          expect(message).property('result').to.be.equal('aborted');
          deferredResolve();
        }
      }),
      { signal: abortController.signal }
    );

    return Promise.all([
      shouldFail(suitePromise, function (err) {
        return err instanceof TestFailureError;
      }),
      deferredPromise,
    ]);
  });

  it('should not emit any start messages after the suite has been cancelled', function () {
    let cancelled = false;
    let deferredReject = (_: Error) => {};
    const deferredPromise = new Promise((_, reject) => (deferredReject = reject));
    const abortController = new AbortController();
    const suitePromise = runTestSuite(
      'suite_various_tests',
      new OnMessage((_, message) => {
        if (message.type === 'start') {
          if (cancelled) {
            deferredReject(new Error('Got start message after cancellation'));
          } else {
            abortController.abort();
            cancelled = true;
          }
        }
      }),
      { signal: abortController.signal }
    );

    return Promise.race([shouldFail(suitePromise), deferredPromise]);
  });

  it('should emit a done message after a suite has been cancelled', function () {
    let deferredResolve = () => {};
    const deferredPromise = new Promise<void>((resolve) => (deferredResolve = resolve));
    const abortController = new AbortController();
    const suitePromise = runTestSuite(
      'suite_single_successful_test',
      {
        gotMessage(_, message) {
          if (message.type === 'start') {
            abortController.abort();
          }
        },
        done() {
          deferredResolve();
        },
      },
      { signal: abortController.signal }
    );

    return Promise.all([
      shouldFail(suitePromise, function (error) {
        return error instanceof TestFailureError;
      }),
      deferredPromise,
    ]);
  });

  it('should emit done messages with the current time as parameter', function () {
    let deferredResolve = () => {};
    const deferredPromise = new Promise<void>((resolve) => (deferredResolve = resolve));
    const { clock, step } = makeFakeClock();
    const suitePromise = runTestSuite(
      'suite_single_successful_test',
      {
        gotMessage: function () {
          step(1); // Step the clock just to be sure that we don't get a stale timestamp
        },
        done: function (time) {
          expect(time).to.be.deep.equal(clock());
          deferredResolve();
        },
      },
      { clock: clock }
    );

    return Promise.all([suitePromise, deferredPromise]);
  });

  it('should gracefully handle when the interface takes forever', function () {
    return shouldFail(
      runTestSuite('suite_neverending_listing', undefined, { listingTimeout: 1000 }),
      (error) =>
        error instanceof TestFailureError &&
        /Timed out while listing tests of .*suite_neverending_listing/.test(error.message)
    );
  });

  describe('breadcrumb handling', function () {
    it('should emit breadcrumb messages when the test leaves a breadcrumb', function () {
      return ensureMessages('suite_leave_breadcrumb', [
        function (testPath, message) {
          expect(message).property('type').to.be.equal('breadcrumb');
          expect(message).property('message').to.be.equal('A breadcrumb');
          expect(message).property('trace').to.be.contain('suite_leave_breadcrumb.js:');
        },
      ]);
    });

    it('should emit breadcrumb message before the test is run', function () {
      return ensureMessages('suite_single_successful_test', [
        function (testPath, message) {
          expect(message).to.be.deep.equal({
            type: 'breadcrumb',
            message: 'Starting test',
            systemGenerated: true,
          });
        },
      ]);
    });

    it('should emit breadcrumb message after the after hooks are done', function () {
      return ensureMessages('suite_single_successful_test', [
        function (testPath, message) {
          expect(message).to.be.deep.equal({
            type: 'breadcrumb',
            message: 'Finished running after hooks',
            systemGenerated: true,
          });
        },
      ]);
    });

    ['before', 'after'].forEach(function (type) {
      it('should emit breadcrumb message before ' + type + ' hooks are run', function () {
        return ensureMessages('suite_' + type + '_hook_and_test', [
          function (testPath, message) {
            expect(message).to.be.deep.equal({
              type: 'breadcrumb',
              message: 'Starting ' + type + ' hook',
              systemGenerated: true,
            });
          },
        ]);
      });

      it('should emit breadcrumb message before named ' + type + ' hooks are run', function () {
        return ensureMessages('suite_test_with_named_' + type + '_hook', [
          function (testPath, message) {
            expect(message).to.be.deep.equal({
              type: 'breadcrumb',
              message: 'Starting ' + type + ' hook "' + type + 'HookName"',
              systemGenerated: true,
            });
          },
        ]);
      });
    });
  });

  describe('debugInfo handling', function () {
    it('should emit debugInfo messages when the test emits debug info', function () {
      return ensureMessages('suite_emit_debug_info', [
        function (testPath, message) {
          expect(message).property('type').to.be.equal('debugInfo');
          expect(message).property('name').to.be.equal('name');
          expect(message).property('value').to.be.deep.equal({ the: 'value' });
        },
      ]);
    });
  });
});
