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
 * Welcome to debugging mode of Overman!
 *
 * When debugging an Overman test, the first thing that happens is that the
 * debugger breaks on this line. The debugger is configured to break at the
 * first line (which is this line), in order to give you a chance to place
 * breakpoints at appropriate places before the test is started.
 *
 * To get started, please locate the source files that are of interest in the
 * "Sources" tab to the left, place breakpoints where appropriate and start the
 * test by clicking the resume button (with an |> icon) to the right.
 */

/**
 * This file is a runnable script that takes three or more command line arguments:
 *
 * 1) An absolute path to the test interface
 * 2) An absolute path to the test file
 * 3+) The "test path", for example ["Suite", "Subsuite", "Test"]
 *
 * It runs the test specified by the arguments and reports the result. An exit code
 * 0 means that the test succeeded, non-0 means that the test failed. More detailed
 * information about the test run is reported to its parent process over process.send.
 */

// @ts-ignore Types incorrect: co can accept a Generator as first param.
import * as co from 'co';
// process.exit that works on Windows
import exit = require('exit');
import * as sourceMapSupport from 'source-map-support';
import * as psTree from 'ps-tree';
import isRunning = require('is-running');
import {
  ChildEntry,
  Hook,
  Runner,
  RunnerAsync,
  RunnerCo,
  SuiteEntry,
  TestEntry,
} from '../interfaces/interface';
import execInterface from '../interfaces/exec';
import { ErrorMessage, Message } from '../reporters/message';
import { ErrorLocation } from '../error_message_util';

sourceMapSupport.install();

const [interfacePath, paramsJSON, testFile, ...testPath] = process.argv.slice(2);

const params = JSON.parse(paramsJSON);
const { interfaceParameter, killSubProcesses, attributes } = params;
let { timeout: testTimeout, slowThreshold } = params;

const cleanup = (() => {
  let cleaned = false;
  return (exitCode: number) => {
    if (!killSubProcesses) {
      exit(exitCode);
    } else if (cleaned) {
      return;
    }
    cleaned = true;
    psTree(process.pid, (_err, children) => {
      children
        .map((p) => Number.parseInt(p.PID, 10))
        .filter((pid) => isRunning(pid))
        .forEach((pid) => process.kill(pid, 'SIGKILL'));
      exit(exitCode);
    });
  };
})();

function sendMessage(message: Message) {
  process.send?.(message);
}

type ErrorExtra = ErrorLocation & Partial<Pick<ErrorMessage, 'stack'>>;

function sendError(error: unknown, extras: ErrorExtra) {
  const stack =
    (error instanceof Error && error.stack) || `Unknown error: ${JSON.stringify(error)}`;
  sendMessage({ type: 'error', stack, ...extras });
}

function isGeneratorOrPromiseFunc<T>(f: Runner<T>): f is RunnerAsync<T> | RunnerCo<T> {
  return f.length === 0;
}

function isGenerator<T>(t?: unknown): t is Iterator<T> {
  return typeof t === 'object' && t !== null && 'next' in t && typeof t.next === 'function';
}

// Takes a function that returns either a promise or a generator and
// returns a promise.
async function invokeGeneratorOrPromiseFunction<T>(f: RunnerAsync<T> | RunnerCo<T>) {
  const result = await f();
  return isGenerator(result) ? co(result) : result;
}

function invokeFunctionNoErrorHandling<T>(f: Runner<T>, extra: ErrorExtra) {
  if (isGeneratorOrPromiseFunc(f)) {
    return invokeGeneratorOrPromiseFunction(f);
  }
  return new Promise<void>((resolve, reject) => {
    let callbackCalled = false;
    f((error) => {
      if (callbackCalled) {
        const suffix = error
          ? `, failing with: ${error instanceof Error ? error.stack : error}`
          : ', succeeding';
        sendError({}, { ...extra, stack: `done callback invoked more than once${suffix}` });
        cleanup(1);
      }

      callbackCalled = true;
      if (error) {
        reject(error);
      } else {
        resolve();
      }
    });
  });
}

async function invokeFunction<T>(f: Runner<T> = () => {}, extra: ErrorExtra) {
  try {
    await invokeFunctionNoErrorHandling(f, extra);
  } catch (error) {
    sendError(error, extra);
    throw error;
  }
}

type TestAndHooks = { test: TestEntry; before: Hook[]; after: Hook[] };

function searchForTest(suite: SuiteEntry, completeTestPath: string[]) {
  function search(
    [basename, ...rest]: string[],
    contents: ChildEntry[],
    before: Hook[] = [],
    after: Hook[] = []
  ): TestAndHooks {
    const entry = contents.find(({ name }) => name === basename);

    if (!entry) {
      throw new Error(`Test with path ${JSON.stringify(completeTestPath)} not found`);
    }

    if (!rest.length) {
      if (entry.type !== 'test') {
        throw new Error(`Test with path ${JSON.stringify(completeTestPath)} is actually a suite`);
      }
      return { test: entry, before, after };
    }

    if (entry.type !== 'suite') {
      throw new Error(`Test with path ${JSON.stringify(completeTestPath)} not found`);
    }
    const { before: entryBefore = [], after: entryAfter = [] } = entry;
    return search(rest, entry.contents, [...before, ...entryBefore], [...entryAfter, ...after]);
  }
  return search(completeTestPath, suite.contents, suite.before, suite.after);
}

async function runHooks(before: boolean, [hook, ...rest]: Hook[]) {
  if (!hook) {
    return;
  }
  const { name } = hook;
  sendMessage({
    type: 'breadcrumb',
    message: `Starting ${before ? 'before' : 'after'} hook${name ? ` "${name}"` : ''}`,
    systemGenerated: true,
  });
  sendMessage({ type: before ? 'startedBeforeHook' : 'startedAfterHook', name });

  try {
    await invokeFunction(hook.run, { in: before ? 'beforeHook' : 'afterHook', inName: name });
    await runHooks(before, rest);
  } catch (error) {
    // Always run after hooks
    if (!before) {
      await runHooks(false, rest);
    }
    throw error;
  }
}

/**
 * Takes a function that doesn't take parameters and returns a function that
 * doesn't take parameters that does the same thing, except that it memoizes the
 * result and subsequent calls to it just returns the initial return value.
 */
function doOnce<T>(f: () => T) {
  let result: { value: T } | undefined;
  return () => {
    if (!result) {
      result = { value: f() };
    }
    return result.value;
  };
}

async function runAfterHooks(hooks: Hook[]) {
  sendMessage({ type: 'startedAfterHooks' });
  await runHooks(false, hooks);
  sendMessage({
    type: 'breadcrumb',
    message: 'Finished running after hooks',
    systemGenerated: true,
  });
  sendMessage({ type: 'finishedAfterHooks' });
}

function makeSureProcessRunsUntilPromiseIsFulfilled(promise: Promise<unknown>) {
  const interval = setInterval(() => {}, 5000);

  return promise.finally(() => clearInterval(interval));
}

async function runTest({ test, before }: TestAndHooks, runAfter: () => void) {
  // Make the process not exit(0) if the test returns a promise that never
  // resolves. It would be nice if it was possible to catch this condition here
  // and exit non-zero, but I don't know how to do that, so instead we make
  // sure to time out.
  sendMessage({ type: 'startedBeforeHooks' });
  const testPromise = runHooks(true, before).then(() => {
    sendMessage({ type: 'startedTest' });
    sendMessage({ type: 'breadcrumb', message: 'Starting test', systemGenerated: true });
    return invokeFunction(test.run, { in: 'test' });
  });

  return makeSureProcessRunsUntilPromiseIsFulfilled(testPromise.finally(() => runAfter()));
}

process.on('uncaughtException', (error) => {
  sendError(error, { in: 'uncaught' });
  cleanup(1);
});

process.on('beforeExit', cleanup);

async function main() {
  const suite = await execInterface(interfacePath, interfaceParameter, testFile, {
    attributes,
    getTimeout: () => testTimeout,
    setTimeout: (value) => {
      testTimeout = value;
      sendMessage({ type: 'setTimeout', value });
    },
    getSlowThreshold: () => slowThreshold,
    setSlowThreshold: (value) => {
      slowThreshold = value;
      sendMessage({ type: 'setSlowThreshold', value });
    },
    leaveBreadcrumb: (message, trace) => sendMessage({ type: 'breadcrumb', message, trace }),
    emitDebugInfo: (name, value) => sendMessage({ type: 'debugInfo', name, value }),
    getTitle: () => testPath,
  });

  const foundTest = searchForTest(suite, testPath);
  const runAfterHooksOnce = doOnce(() => runAfterHooks(foundTest.after));

  process.on('message', (message: { type: string }) => {
    if (message.type === 'sigint') {
      runAfterHooksOnce()
        .catch(() => {})
        .finally(() => cleanup(1));
    }
  });

  // Orphan detection
  setInterval(() => {
    try {
      sendMessage({} as Message);
    } catch (e) {
      console.warn(`Overman has died unexpectedly, cleaning up ${process.pid}`);
      cleanup(2);
    }
  }, 1000);

  try {
    await runTest(foundTest, runAfterHooksOnce);
    cleanup(0);
  } catch (_) {
    cleanup(1);
  }
}

main();
