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

import * as async from 'async';
import * as childProcess from 'child_process';
import { expect } from 'chai';
import * as path from 'path';
import { listTestsOfFile, ListTestError } from './list_suite';
import defaultSoftKill, { SoftKill } from './soft_kill';
import TimestamperReporter from './reporters/timestamper';
import CombinedReporter from './reporters/combined';
import CancellableReporter from './reporters/cancellable';
import ErrorDetectorReporter from './reporters/error_detector';
import SpecReporter from './reporters/spec';
import * as errorMessageUtil from './error_message_util';
import TestFailureError from './test_failure_error';
import TimeoutTimer, { Timer } from './timeout_timer';
import Reporter, { RegisterOptions } from './reporters/reporter';
import { TestPath } from './test_path';
import { Readable, Writable } from 'stream';
import { FinishMessage, IOMessage, Message, RetryMessage } from './reporters/message';
import InternalReporter from './reporters/internal_reporter';
import { TestSpec } from './test_spec';
import { ProcessLike } from './process_like';

const defaultInterface = `${__dirname}/interfaces/bdd_mocha`;

/**
 * Types used in this file:
 * * Test path
 * * Suite descriptor
 */

function reportSkippedTest(reporter: InternalReporter, testPath: TestPath, unstable: boolean) {
  reporter.gotMessage(testPath, { type: 'start', skipped: true, unstable: unstable });
  reporter.gotMessage(testPath, { type: 'finish', result: 'skipped', unstable: unstable });
}

function hookStream(
  testPath: TestPath,
  stream: Readable,
  reporter: InternalReporter,
  type: IOMessage['type']
) {
  const onData = (data: string) => reporter.gotMessage(testPath, { type, data });
  stream.on('data', (data) => onData(data.toString()));
}

function runTestProcess(
  childProcess: ChildProcessModuleLike,
  debugPort: number | undefined,
  timeout: unknown,
  slowThreshold: unknown,
  reporter: InternalReporter,
  testInterfacePath: string,
  interfaceParameter: unknown,
  testPath: TestPath,
  killSubProcesses: unknown,
  attributes: unknown
): ProcessLike {
  const parameters = { timeout, slowThreshold, interfaceParameter, killSubProcesses, attributes };
  const debugArgs = debugPort ? ['--inspect-brk=' + debugPort] : [];
  const child = childProcess.fork(
    `${__dirname}/bin/run_test`,
    [testInterfacePath, JSON.stringify(parameters), testPath.file, ...testPath.path],
    { silent: true, execArgv: [...process.execArgv, ...debugArgs] }
  );

  // might be null in case of listening for debugger
  if (child.stdout && child.stderr) {
    hookStream(testPath, child.stdout, reporter, 'stdout');
    hookStream(testPath, child.stderr, reporter, 'stderr');
  }

  return child;
}

function killAfter(
  softKill: SoftKill,
  timerFactory: TimerFactory,
  child: ProcessLike,
  timeToWait: number,
  graceTime: number,
  willKill: () => void
) {
  const timer = timerFactory(timeToWait);
  timer.on('timeout', () => {
    willKill();
    softKill(child, graceTime);
  });

  child.on('exit', () => timer.cancel());

  child.on('message', (message: Message) => {
    if (message.type === 'setTimeout' && typeof message.value === 'number') {
      timer.updateTimeout(message.value);
    }
  });
}

function runTest(
  softKill: SoftKill,
  timerFactory: TimerFactory,
  childProcess: ChildProcessModuleLike,
  debugPort: number | undefined,
  timeout: number,
  graceTime: number,
  slowThreshold: unknown,
  reporter: InternalReporter,
  testInterfacePath: string,
  testInterfaceParameter: unknown,
  testPath: TestPath,
  unstable: boolean,
  killSubProcesses: unknown,
  attributes: unknown
) {
  let didTimeout = false;
  const child = runTestProcess(
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

  child.on('message', (message: Message) => reporter.gotMessage(testPath, message));

  if (timeout !== 0) {
    killAfter(softKill, timerFactory, child, timeout, graceTime, () => {
      didTimeout = true;
      reporter.gotMessage(testPath, { type: 'timeout' });
    });
  }

  const closePromise = new Promise<void>((resolve) => child.on('close', () => resolve()));

  return new Promise<void>((resolve, reject) => {
    child.on('exit', (code, signal) => {
      // The 'close' event is typically emitted *after* the 'exit' event. This means
      // that when we get to this point, there may still be outstanding messages in
      // flight from the child process. Because of that, we need to wait for 'close'.
      closePromise.then(() => {
        if (didTimeout) {
          reporter.gotMessage(testPath, { type: 'finish', result: 'timeout', unstable });
          reject(new Error('Test timed out'));
        } else {
          reporter.gotMessage(testPath, {
            type: 'finish',
            result: code === 0 ? 'success' : 'failure',
            unstable: unstable,
            code: code ?? undefined,
            signal: signal ?? undefined,
          });

          if (code === 0) {
            resolve();
          } else if (signal) {
            reject(new Error(`Test process exited with signal ${signal}`));
          } else {
            reject(new Error(`Test process exited with non-zero exit code ${code}`));
          }
        }
      }, reject);
    });
  });
}

function runTestWithRetries(
  softKill: SoftKill,
  timerFactory: TimerFactory,
  childProcess: ChildProcessModuleLike,
  debugPort: number | undefined,
  timeout: number,
  graceTime: number,
  attempts: number,
  slowThreshold: unknown,
  reporter: InternalReporter,
  testInterfacePath: string,
  testInterfaceParameter: unknown,
  testPath: TestPath,
  unstable: boolean,
  killSubProcesses: unknown,
  attributes: unknown
): Promise<void> {
  // When tests are retried, we need to "lie" about the finish message; tests
  // that are retried aren't actually finished, so they should not be reported
  // as such.
  class RetryingReporter implements InternalReporter {
    _postponedFinishMessage: FinishMessage | undefined;
    constructor(private inner: InternalReporter) {}
    registerTests(tests: TestPath[], options: RegisterOptions): void {
      this.inner.registerTests(tests, options);
    }
    registrationFailed(error: Error): void {
      this.inner.registrationFailed(error);
    }
    gotMessage(testPath: TestPath, message: Message): void {
      if (message.type === 'finish') {
        this._postponedFinishMessage = message;
      } else {
        this.inner.gotMessage(testPath, message);
      }
    }
    done(): void {
      this.inner.done();
    }
    sendPostponsedFinishMessage(changeToRetry?: boolean) {
      expect(this._postponedFinishMessage).not.to.be.undefined;
      const message = changeToRetry
        ? ({ ...this._postponedFinishMessage, type: 'retry' } as RetryMessage)
        : this._postponedFinishMessage!;
      this.inner.gotMessage(testPath, message);
    }
  }

  const retryingReporter = new RetryingReporter(reporter);

  return runTest(
    softKill,
    timerFactory,
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
    .then(() => retryingReporter.sendPostponsedFinishMessage())
    .catch((error) => {
      retryingReporter.sendPostponsedFinishMessage(attempts > 1);

      if (attempts <= 1) {
        throw error;
      }
      return runTestWithRetries(
        softKill,
        timerFactory,
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
    });
}

async function runOrSkipTest(
  softKill: SoftKill,
  timerFactory: TimerFactory,
  childProcess: ChildProcessModuleLike,
  debugPort: number | undefined,
  attempts: number,
  globalTimeout: number,
  graceTime: number,
  globalSlowThreshold: number,
  reporter: InternalReporter,
  testInterfacePath: string,
  testInterfaceParameter: unknown,
  testDescriptor: TestSpec,
  runUnstable: boolean | undefined,
  killSubProcesses: unknown
) {
  const testPath = testDescriptor.path;
  const testAttributes = testDescriptor.attributes;
  const unstable = !!testDescriptor.unstable;

  if (testDescriptor.skipped || (unstable && !runUnstable)) {
    reportSkippedTest(reporter, testPath, unstable);
    return;
  }
  reporter.gotMessage(testPath, { type: 'start', unstable });
  if (testAttributes) {
    reporter.gotMessage(testPath, { type: 'attributes', attributes: testAttributes });
  }
  const timeout =
    typeof testDescriptor.timeout === 'number' ? testDescriptor.timeout : globalTimeout;
  const slowThreshold =
    typeof testDescriptor.slow === 'number' ? testDescriptor.slow : globalSlowThreshold;

  await runTestWithRetries(
    softKill,
    timerFactory,
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

/**
 * Takes a list of tests. If none of the tests are marked as "only", then returns
 * the entire list. Otherwise returns only the tests that are marked as "only".
 */
function filterOnly(disallowOnly: boolean | undefined, tests: TestSpec[]) {
  const onlyTests = tests.filter((test) => test.only);

  if (disallowOnly && onlyTests.length !== 0) {
    throw new Error('Encountered tests marked as .only, and the disallowOnly flag is set');
  }

  return onlyTests.length === 0 ? tests : onlyTests;
}

function filterAttributes(attributeFilter: AttributesFilter | undefined, tests: TestSpec[]) {
  if (!attributeFilter) {
    return tests;
  }
  return tests.filter((test) => {
    const attributes = test.attributes || {};
    try {
      return attributeFilter(attributes);
    } catch (error) {
      if (error instanceof Error) {
        error.message = `Encountered error while filtering attributes: ${error.message}`;
      }
      throw error;
    }
  });
}

function filterTest(testFilter: TestSpecFilter | undefined, tests: TestSpec[]) {
  if (!testFilter) {
    return tests;
  }
  return tests.filter((test) => {
    try {
      return testFilter(test);
    } catch (error) {
      if (error instanceof Error) {
        error.message = 'Encountered error while filtering tests: ' + error.message;
      }
      throw error;
    }
  });
}

function filterGrep(
  grep: string | RegExp | undefined,
  invertGrep: boolean | undefined,
  tests: TestSpec[]
) {
  if (!grep) {
    return tests;
  }
  return tests.filter((test) => {
    const match = test.path.path.join(' ').match(grep);
    return invertGrep ? !match : match;
  });
}

async function listTestsOfFiles(
  timeout: number,
  testInterfacePath: string,
  testInterfaceParameter: string | undefined,
  files: string[]
) {
  const fileTests = await Promise.all(
    files.map((file) => listTestsOfFile(timeout, testInterfacePath, testInterfaceParameter, file))
  );
  return fileTests.flat();
}

async function listTests(
  reporter: InternalReporter,
  timeout: number,
  testInterfacePath: string,
  testInterfaceParameter: string | undefined,
  files: string[]
) {
  try {
    return await listTestsOfFiles(timeout, testInterfacePath, testInterfaceParameter, files);
  } catch (error) {
    if (!(error instanceof ListTestError)) {
      throw error;
    }
    reporter.registrationFailed(error);
    throw new TestFailureError(error.timeout ? error.message : 'Failed to process test files');
  }
}

// Export Public API

export type AttributesFilter = (attributes: Record<string, unknown>) => boolean;
export type ChildProcessModuleLike = {
  fork(..._: Parameters<typeof childProcess['fork']>): ProcessLike;
};
export type TestSpecFilter = (test: TestSpec) => boolean;
export type TimerFactory = (timeToWait: number) => Timer;

export interface Options {
  files: string[];
  timeout?: number;
  listingTimeout?: number;
  slowThreshold?: number;
  graceTime?: number;
  attempts?: number;
  interface?: string;
  interfaceParameter?: string;
  clock?: () => Date;
  reporters?: Reporter[] | Reporter;
  internalErrorOutput?: Writable;
  disallowOnly?: boolean;
  attributeFilter?: AttributesFilter;
  testFilter?: TestSpecFilter;
  grep?: string | RegExp;
  invertGrep?: boolean;
  debugPort?: number;
  softKill?: SoftKill;
  timerFactory?: TimerFactory;
  childProcess?: ChildProcessModuleLike;
  runUnstable?: boolean;
  killSubProcesses?: boolean;
  parallelism?: number;
  signal?: AbortSignal;
}
export { ProcessLike, Timer, TestSpec, SoftKill };

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
export default function (options: Options) {
  const timeout = options.timeout ?? 10000;
  const listingTimeout = options.listingTimeout ?? 60000;
  const slowThreshold = options.slowThreshold || 1000;
  const graceTime = options.graceTime ?? 500;
  const attempts = options.attempts || 0;
  const testInterfacePath = path.resolve(options.interface || defaultInterface);
  const testInterfaceParameter = options.interfaceParameter;
  const errorDetector = new ErrorDetectorReporter();
  const clock = options.clock ?? (() => new Date());
  const reporters = options.reporters ?? [new SpecReporter(process)];
  const internalErrorOutput: Writable = options.internalErrorOutput ?? process.stderr;
  const reporter = new CancellableReporter(
    new TimestamperReporter(
      new CombinedReporter([
        errorDetector,
        ...(Array.isArray(reporters) ? reporters : [reporters]),
      ]),
      clock
    )
  );

  if (!Array.isArray(options.files)) {
    throw new Error('Option "files" not present or not Array');
  }

  options.signal?.addEventListener('abort', () => {
    if (!reporter.isFinished()) {
      reporter.cancel();
    }
  });

  const resultPromise = listTests(
    reporter,
    listingTimeout,
    testInterfacePath,
    testInterfaceParameter,
    options.files
  )
    .then((tests) => filterOnly(options.disallowOnly, tests))
    .then((tests) => filterAttributes(options.attributeFilter, tests))
    .then((tests) => filterTest(options.testFilter, tests))
    .then((tests) => filterGrep(options.grep, options.invertGrep, tests))
    .then((tests) => {
      if (options.debugPort) {
        tests = tests.slice(0, 1); // Only run one test when debugging
      }

      if (!tests.length) {
        throw new Error('No tests found');
      }

      reporter.registerTests(
        tests.map((test) => test.path),
        { timeout, listingTimeout, slowThreshold, graceTime, attempts }
      );

      return async.parallelLimit(
        tests.map((test) => (done) => {
          if (reporter.isFinished()) {
            done();
            return;
          }
          return runOrSkipTest(
            options.softKill ?? defaultSoftKill,
            options.timerFactory ?? ((timeout) => new TimeoutTimer(timeout)),
            options.childProcess ?? childProcess,
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
          )
            .catch(() => {})
            .finally(() => done());
        }),
        options.parallelism || 8
      );
    })
    .then(async () => {
      const cancelled = reporter.isFinished();

      reporter.done();

      if (cancelled) {
        throw new TestFailureError('Tests cancelled');
      } else if (errorDetector.didFail()) {
        throw new TestFailureError(
          `Tests failed: testpath: ${JSON.stringify(
            errorDetector.testPath()
          )} message: ${JSON.stringify(errorDetector.message())}`
        );
      }
    })
    .catch((error) => {
      if (!(error instanceof TestFailureError)) {
        // Test failures will already have been reported by reporters, so there
        // is no need for us to report them here.
        internalErrorOutput.write('Internal error in Overman or a reporter:\n');
        internalErrorOutput.write(
          `${errorMessageUtil.indent(errorMessageUtil.prettyError(error), 2)}\n`
        );
      }

      throw error;
    });

  return resultPromise;
}
