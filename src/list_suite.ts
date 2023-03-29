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
 * This file is a node module that exposes functionality to list the tests
 * that a given test suite has. It uses the bin/list_suite script to do this.
 */

import * as childProcess from 'child_process';
import { ChildProcessWithoutNullStreams, ForkOptions } from 'child_process';
import { Readable } from 'stream';
import { setTimeout } from 'timers/promises';
import { TestSpec } from './test_spec';

function streamToString(stream: Readable) {
  return new Promise<string>((resolve) => {
    let string = '';
    stream.on('data', (data) => (string += data));
    stream.on('end', () => resolve(string));
  });
}

function withTimeout<T>(promise: Promise<T>, timeout: number, onTimeout: () => T) {
  if (timeout === 0) {
    return promise;
  }
  const ac = new AbortController();
  const { signal } = ac;
  const abort = () => ac.abort();
  return Promise.race([setTimeout(timeout, 0, { signal }).then(onTimeout), promise.finally(abort)]);
}

/**
 * An error "class" that means that an error occured when listing the tests of
 * a suite.
 */
export class ListTestError extends Error {
  constructor(message?: string, errorOutput?: string, public readonly timeout = false) {
    super(message);
    this.stack = this.message + (errorOutput ? ':\n' + errorOutput : '');
  }
}

export type ForkFn = (
  modulePath: string,
  args: ReadonlyArray<string>,
  options?: ForkOptions
) => ChildProcessWithoutNullStreams;

export type Options = { fork?: ForkFn };

export function listTestsOfFile(
  timeout: number,
  testInterfacePath: string,
  testInterfaceParameter = '',
  suite: string,
  options: Options = {}
) {
  const fork = options.fork ?? (childProcess.fork as ForkFn);
  const args = [testInterfacePath, testInterfaceParameter, suite];
  const child = fork(`${__dirname}/bin/list_suite`, args, { silent: true });

  const successObjectPromise: Promise<TestSpec[]> = streamToString(child.stdout)
    .then((stdoutStr) => JSON.parse(stdoutStr))
    .catch(() => []);

  const stderrPromise = streamToString(child.stderr);

  const resultPromise = new Promise<number>((resolve) => child.on('exit', resolve)).then((code) =>
    code === 0
      ? successObjectPromise
      : stderrPromise.then((stderrStr) => {
          throw new ListTestError(`Failed to process ${suite}`, stderrStr);
        })
  );

  return withTimeout(resultPromise, timeout, () => {
    child.kill('SIGKILL');
    throw new ListTestError(`Timed out while listing tests of ${suite}`, undefined, true);
  });
}
