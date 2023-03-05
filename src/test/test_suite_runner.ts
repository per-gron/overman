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

import * as childProcess from 'child_process';
import * as psTree from 'ps-tree';
import isRunning = require('is-running');
import * as chai from 'chai';
import { expect } from 'chai';
import * as through from 'through';
import OnMessage from './util/on_message';
import * as streamUtil from './util/stream';
import shouldFail from './util/should_fail';
import { setTimeout } from 'timers/promises';
import TestFailureError from '../test_failure_error';
import suiteRunner, { ChildProcessModuleLike, Options } from '../suite_runner';
import * as chaiAsPromised from 'chai-as-promised';
import { TestPath } from '../test_path';
import { Message } from '../reporters/message';
import { FakeProcess } from '../fakes/fake_process_like';
import Reporter from '../reporters/reporter';
import { SoftKill } from '../soft_kill';

chai.use(chaiAsPromised);

class ParallelismCounter {
  maxParallelism = 0;
  _currentTests = new Set<string>();

  gotMessage(testPath: TestPath, message: Message) {
    const pathAsString = JSON.stringify(testPath);
    if (message.type === 'start') {
      this._currentTests.add(pathAsString);

      this.maxParallelism = Math.max(this.maxParallelism, this._currentTests.size);
    } else if (message.type === 'finish') {
      this._currentTests.delete(pathAsString);
    }
  }
}

function listNames(names: string[]) {
  return names.map((name) => `"${name}"`).join(', ');
}

function runTestSuite(suite: string, reporters?: Reporter[], options?: Partial<Options>) {
  return suiteRunner({
    files: [`${__dirname}/../../data/suite/${suite}`],
    timeout: 4000,
    reporters: reporters || [],
    internalErrorOutput: through(),
    ...options,
  });
}

/**
 * A function that takes a test suite and a dictionary from test names to
 * an array of the lines that the given test should print to stdout.
 *
 * Returns a promise that succeeds only if all tests succeed (unless
 * options.allowTestsToFail), only tests that were specified are run and
 * the test output exactly matches the specification.
 */
function ensureOutputFromTests(
  suite: string,
  tests: Record<string, (string | RegExp)[]>,
  options?: Partial<Options> & { allowTestsToFail?: boolean }
) {
  const gotStartForTests: string[] = [];
  const reporters: Reporter[] = [];
  const encounteredTests = new Set<string>();

  const testsPromises = Object.entries(tests).map(([testName, lines]) => {
    const out = through();

    return new Promise((resolve, reject) => {
      reporters.push(
        new OnMessage((testPath, message) => {
          const currentTestName = testPath.path.at(-1)!;
          if (message.type === 'start' && !message.skipped) {
            encounteredTests.add(currentTestName);
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

  const suitePromise = runTestSuite(suite, reporters, options)
    .catch((error) => {
      if (!options || !options.allowTestsToFail) {
        throw error;
      }
    })
    .then(() => {
      const testNames = new Set(Object.keys(tests));
      if (gotStartForTests.length < testNames.size) {
        const missingTests = testNames;
        gotStartForTests.forEach((test) => missingTests.delete(test));

        throw new Error(
          'Did not run all tests (ran ' +
            listNames(gotStartForTests) +
            '. Missing ' +
            listNames([...missingTests]) +
            ')'
        );
      }
    });

  return Promise.all(testsPromises.concat([suitePromise])).then(() => {
    const lhs = Object.keys(encounteredTests).sort();
    const rhs = Object.keys(tests).sort();

    if (!lhs.every((lhs, i) => lhs === rhs[i])) {
      const set = new Set(lhs);
      rhs.forEach((s) => set.delete(s));
      throw new Error('Encountered unexpected tests ' + listNames([...rhs]));
    }
  });
}

describe('Suite runner', function () {
  it('should require files parameter', function () {
    expect(function () {
      suiteRunner({} as Options);
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
    return shouldFail(
      runTestSuite('suite_various_tests'),
      (error) => error instanceof TestFailureError && /failed/.test(error.message)
    );
  });

  it('should fail with TestFailureError if a test has a syntax error', function () {
    return shouldFail(runTestSuite('suite_syntax_error'), (err) => err instanceof TestFailureError);
  });

  it('should not leak things to the runloop', function () {
    return Promise.race([
      setTimeout(2000).then(() => {
        throw new Error('Should be done by now');
      }),
      new Promise<void>((resolve, reject) => {
        const child = childProcess.fork(__dirname + '/util/run_single_test');

        child.on('exit', (code) => {
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
    let killSubProcesses = false;
    const mockChildProcess: ChildProcessModuleLike = {
      fork: (path, args) => {
        if (!Array.isArray(args)) {
          throw new Error();
        }
        killSubProcesses = JSON.parse(args[1]).killSubProcesses;
        return childProcess.fork(path, args);
      },
    };
    return runTestSuite('suite_single_successful_test', [], {
      childProcess: mockChildProcess,
      killSubProcesses: true,
    }).then(() => expect(killSubProcesses).to.be.true);
  });

  it('should emit attributes message for test with attributes', function () {
    const attributes: Record<string, unknown>[] = [];
    const reporter = new OnMessage((_, message) => {
      if (message.type === 'attributes') {
        attributes.push(message.attributes);
      }
    });
    return runTestSuite('suite_attributes', [reporter]).then(() => {
      expect(attributes).to.be.deep.equal([
        { foo: 'baz', bar: 'qux' },
        { foo: 'quux', bar: 'qux' },
      ]);
    });
  });

  describe('Stdio', function () {
    const testSuite = {
      stdout: 'suite_single_successful_test',
      stderr: 'suite_single_successful_test_stderr',
    };

    (Object.keys(testSuite) as (keyof typeof testSuite)[]).forEach((streamName) => {
      it(`should forward ${streamName} data`, function () {
        return new Promise<void>((resolve) => {
          runTestSuite(testSuite[streamName], [
            {
              gotMessage(_, message) {
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
      const suitePromise = runTestSuite('suite_single_successful_test', [
        new OnMessage((_, message) => {
          if (message.type === 'start') {
            suitePromise.cancel();
          }
        }),
      ]);
      return shouldFail(
        suitePromise,
        (error) => error instanceof TestFailureError && /cancelled/.test(error.message)
      );
    });

    it('should do nothing when cancelled after the suite is done', async function () {
      let doneCalledTimes = 0;

      const suitePromise = runTestSuite('suite_single_successful_test', [
        { done: () => doneCalledTimes++ },
      ]);
      await suitePromise;
      expect(doneCalledTimes, 'done should have been called').to.be.equal(1);
      suitePromise.cancel();
      expect(
        doneCalledTimes,
        'done should not be called when cancelling finished suite'
      ).to.be.equal(1);
    });

    it('should do nothing when cancelled subsequent times', function () {
      let doneCalledTimes = 0;

      const suitePromise = runTestSuite('suite_single_successful_test', [
        {
          gotMessage: (_, message) => {
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
          done: () => doneCalledTimes++,
        },
      ]);
      return shouldFail(
        suitePromise,
        (error) => error instanceof TestFailureError && /cancelled/.test(error.message)
      );
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

  it('should run tests in parallel by default', async function () {
    const counter = new ParallelismCounter();
    await runTestSuite('suite_various_tests', [counter]).catch(() => {});
    expect(counter).to.have.property('maxParallelism').that.is.gt(3);
  });

  it('should run tests sequentially', async function () {
    const counter = new ParallelismCounter();
    await runTestSuite('suite_various_tests', [counter], { parallelism: 1 }).catch(() => {});
    expect(counter).to.have.property('maxParallelism').that.is.equal(1);
  });

  it('should run tests in parallel', async function () {
    const counter = new ParallelismCounter();
    await runTestSuite('suite_various_tests', [counter], { parallelism: 3 }).catch(() => {});
    expect(counter).to.have.property('maxParallelism').that.is.equal(3);
  });

  it('should fail when encountering .only tests and disallowOnly is set', function () {
    return shouldFail(runTestSuite('suite_single_only_test', [], { disallowOnly: true }));
  });

  it('should detect and kill orphan childprocess', async function () {
    const proc = childProcess.fork('dist/test/util/run_single_test_that_never_finishes.js');
    const pids = await new Promise<number[]>((resolve) => {
      const timeout = setInterval(() => {
        psTree(process.pid, (_err, children) => {
          const childrenPID = children
            .filter((p) => {
              // command key is different on linux/windows
              type WindowsPS = psTree.PS & { COMM: string };
              const command = p.COMMAND ? p.COMMAND : (p as WindowsPS).COMM;
              return command.includes('node');
            })
            .map((p) => Number.parseInt(p.PID, 10));
          if (childrenPID.length === 2) {
            proc.kill('SIGKILL');
            clearInterval(timeout);
            resolve(childrenPID);
          }
        });
      }, 300);
    });
    await new Promise<void>((resolve) =>
      setInterval(() => pids.every((pid) => !isRunning(pid)) && resolve(), 300)
    );
  });

  describe('Attribute filter', function () {
    it('should run only tests that passes the attribute filter function', function () {
      return ensureOutputFromTests(
        'suite_attributes',
        { 'should override': [] },
        { attributeFilter: (attributes) => attributes.foo === 'baz' }
      );
    });

    it('should emit error for attribute filter which throws', function () {
      const attributeFilter = () => {
        throw new Error('client error');
      };
      const suitePromise = runTestSuite('suite_attributes', [], { attributeFilter });
      return shouldFail(
        suitePromise,
        (error) =>
          error instanceof Error &&
          /^Encountered error while filtering attributes/.test(error.message)
      );
    });
  });

  describe('Test filter', function () {
    it('should run only tests that passes the filter function', function () {
      return ensureOutputFromTests(
        'suite_attributes',
        { 'should override': [] },
        { testFilter: (test) => test.attributes?.foo === 'baz' }
      );
    });

    it('should emit error for test filter which throws', function () {
      const testFilter = () => {
        throw new Error('client error');
      };
      const suitePromise = runTestSuite('suite_attributes', [], { testFilter });
      return shouldFail(
        suitePromise,
        (error) =>
          error instanceof Error && /^Encountered error while filtering tests/.test(error.message)
      );
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
    const out = streamUtil.stripAnsiStream();

    const streamOutput = streamUtil.waitForStreamToEmitLines(out, [
      /Internal error in Overman or a reporter:/,
      /Test/,
      /stack/,
      /.*/,
    ]);

    const error = new Error('Test');
    error.stack = 'Test\nstack';

    const suitePromise = suiteRunner({
      files: [__dirname + '/../../data/suite/suite_test_title'],
      reporters: [
        {
          registerTests() {
            throw error;
          },
        },
      ],
      internalErrorOutput: out,
    });

    const expectFailure = shouldFail(suitePromise, (raisedError) => raisedError === error);

    return Promise.all([streamOutput, expectFailure.finally(() => out.end())]);
  });

  describe('Timeouts', function () {
    it('should pass timeout to test', function () {
      return ensureOutputFromTests(
        'suite_timeout_print',
        {
          'should print its timeout': ['1337'],
        },
        { timeout: 1337 }
      );
    });

    it('should let the test set the timeout', function () {
      return Promise.race([
        shouldFail(runTestSuite('suite_timeout_set', [], { timeout: 2000 })),
        setTimeout(1500).then(function () {
          throw new Error('Test should have finished by now');
        }),
      ]);
    });

    it('should respect per test timeout overrides', function () {
      return ensureOutputFromTests('suite_timeout_set_in_suite', {
        'should print its timeout': ['1234'],
      });
    });

    it('should respect listingTimeout', function () {
      return shouldFail(
        runTestSuite('suite_single_successful_test', [], {
          listingTimeout: 1,
        }),
        (error) =>
          error instanceof TestFailureError && /Timed out while listing tests/.test(error.message)
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
      class Child extends FakeProcess {
        constructor(private deferredResolve: () => void) {
          super(
            () => {},
            (message) => {
              expect(message).property('type').to.be.equal('sigint');
              this.emit('exit', 0, null);
              this.emit('close');
              this.deferredResolve();
            }
          );
        }
      }

      let deferredResolve = (..._: unknown[]) => {};
      const deferredPromise = new Promise((resolve) => (deferredResolve = resolve));

      const fork = () => new Child(deferredResolve);

      return Promise.all([
        shouldFail(
          runTestSuite('suite_single_test_that_never_finishes', [], {
            childProcess: { fork },
            timeout: 10,
          }),
          (error) => error instanceof TestFailureError && /Tests failed/.test(error.message)
        ),
        deferredPromise,
      ]);
    });

    it('should suppress all messages from a test process after it times out', async function () {
      class Child extends FakeProcess {
        constructor(private didTimeout: () => void) {
          super(
            () => {},
            (message) => {
              expect(message).property('type').to.be.equal('sigint');
              this.emit('message', { type: 'debugInfo', name: 'a', value: 'should be suppressed' });
              this.emit('exit', 0, null);
              this.emit('close');
              this.didTimeout();
            }
          );
        }
      }

      let lastMessage = null;
      let didTimeout = false;

      const fork = () => new Child(() => (didTimeout = true));

      await shouldFail(
        runTestSuite('suite_single_test_that_never_finishes', [], {
          childProcess: { fork },
          timeout: 10,
          reporters: [new OnMessage((_, message) => (lastMessage = message))],
        }),
        (error) => error instanceof TestFailureError && /Tests failed/.test(error.message)
      );

      expect(didTimeout, "The test wasn't run as expected").to.be.true;
      expect(lastMessage, 'Finish should be the last message sent').to.be.deep.equal({
        type: 'finish',
        result: 'timeout',
        unstable: false,
      });
    });

    it("should send SIGKILL to tests that don't die after 'sigint' message", function () {
      class Child extends FakeProcess {
        constructor(private deferredResolve: () => void) {
          super((signal) => {
            expect(signal).to.be.equal('SIGKILL');
            this.emit('exit', 0, null);
            this.emit('close');
            this.deferredResolve();
          });
        }
      }

      let deferredResolve = (..._: unknown[]) => {};
      const deferredPromise = new Promise((resolve) => (deferredResolve = resolve));

      const fork = () => new Child(deferredResolve);

      return Promise.all([
        shouldFail(
          runTestSuite('suite_single_test_that_never_finishes', [], {
            childProcess: { fork },
            timeout: 10,
          }),
          (error) => error instanceof TestFailureError && /Tests failed/.test(error.message)
        ),
        deferredPromise,
      ]);
    });

    [0, 1234].forEach(function (graceTime) {
      it('should respect the graceTime parameter of ' + graceTime, function () {
        let softKillResolve = (..._: unknown[]) => {};
        const softKillPromise = new Promise((resolve) => (softKillResolve = resolve));

        const softKill: SoftKill = (process, timeout) => {
          process.kill('SIGKILL');
          expect(timeout).to.be.equal(graceTime);
          softKillResolve();
        };

        const suitePromise = shouldFail(
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
        timerFactory() {
          throw new Error('No TimeoutTimer should be instantiated when timeout is 0');
        },
      });
    });
  });

  describe('Retries', function () {
    function countAttempts(
      suite: string,
      attempts: number,
      suiteShouldFail = false,
      options?: ChildProcessModuleLike & Partial<Options>
    ) {
      let retryAttempts = 0;

      const realFork = (options || {}).fork || childProcess.fork;
      const fork: ChildProcessModuleLike['fork'] = (...args) => {
        retryAttempts++;
        return realFork(...(args as Parameters<typeof realFork>));
      };

      const suitePromise = runTestSuite(suite, [], {
        attempts: attempts,
        childProcess: { fork: fork },
        timeout: (options || {}).timeout,
      });

      return (
        suiteShouldFail
          ? shouldFail(suitePromise, (err) => err instanceof TestFailureError)
          : suitePromise
      ).then(() => retryAttempts);
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

    it('should retry tests that time out even when the test process exits with a 0 exit code', async function () {
      class Child extends FakeProcess {
        constructor() {
          super(
            () => {},
            (message) => {
              expect(message).property('type').to.be.equal('sigint');
              this.emit('exit', 0, null);
              this.emit('close');
            }
          );
        }
      }

      const fork = () => new Child();

      const attempts = await countAttempts('suite_single_successful_test', 2, true, {
        timeout: 10,
        fork,
      });
      expect(attempts).to.be.equal(2);
    });
  });

  describe('Slow thresholds', function () {
    it('should pass slow threshold to test', function () {
      return ensureOutputFromTests(
        'suite_slow_print',
        {
          'should print its slow threshold': ['1337'],
        },
        { slowThreshold: 1337 }
      );
    });

    it('should respect per test slow threshold overrides', function () {
      return ensureOutputFromTests('suite_slow_set_in_suite', {
        'should print its slowness threshold': ['1234'],
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
          interface: __dirname + '/../../data/util/dummy_parameterized_interface',
          interfaceParameter: 'interface_param',
        }
      );
    });
  });

  describe('Debug', function () {
    it('should run only one test when debugPort is specified', async function () {
      let suiteTests = [];
      await runTestSuite('suite_two_passing_tests', [], {
        reporters: [
          {
            registerTests(tests) {
              suiteTests = tests;
            },
          },
        ],
        debugPort: 1234,
      }).catch(() => {});

      expect(suiteTests.length).to.be.equal(1);
    });

    function extractSubprocessForkOptions(options: Partial<Options>) {
      return new Promise((resolve, reject) => {
        const mockChildProcess: ChildProcessModuleLike = {
          fork: (...args) => {
            resolve(args[2]);
            return new FakeProcess();
          },
        };
        runTestSuite('suite_single_successful_test', [], {
          childProcess: mockChildProcess,
          ...options,
        }).catch(reject);
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
