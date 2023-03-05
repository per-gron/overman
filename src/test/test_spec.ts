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

import * as through from 'through';
import { RegisterOptions } from '../reporters/reporter';
import SpecReporter from '../reporters/spec';
import suiteRunner from '../suite_runner';
import OnMessage from './util/on_message';
import { stripAnsiStream, waitForStreamToEmitLine, waitForStreamToEmitLines } from './util/stream';

const REG_OPTS: RegisterOptions = {
  timeout: 0,
  listingTimeout: 0,
  slowThreshold: 0,
  graceTime: 0,
  attempts: 0,
};
const DATE = new Date(42);

function simulateOneTest(spec: SpecReporter) {
  const path = { file: 'file', path: ['suite_name', 'test'] };
  const END = new Date(DATE.getTime() + 123);

  spec.registerTests([path], { ...REG_OPTS, slowThreshold: 100 }, DATE);
  spec.gotMessage(path, { type: 'start' }, DATE);
  spec.gotMessage(path, { type: 'startedTest' }, DATE);
  spec.gotMessage(path, { type: 'startedAfterHooks' }, END);
  spec.gotMessage(path, { type: 'finish', result: 'success' }, END);
  spec.done(END);
}

function simulateAndWaitForLine(simulate: (_: SpecReporter) => void, line: string | RegExp) {
  const stdout = stripAnsiStream();

  const outputPromise = waitForStreamToEmitLine(stdout, line);

  const spec = new SpecReporter({ stdout });
  simulate(spec);

  stdout.end();

  return outputPromise;
}

function simulateOneTestAndWaitForLine(line: string | RegExp) {
  return simulateAndWaitForLine(simulateOneTest, line);
}

describe('Spec reporter', function () {
  it('should mark slow tests', function () {
    return simulateOneTestAndWaitForLine(/\(123ms\)/);
  });

  it('should mark suites', function () {
    return simulateOneTestAndWaitForLine(/suite_name/);
  });

  it('should emit a summary', function () {
    return simulateOneTestAndWaitForLine(/1 passing/);
  });

  it('should print details about errors', function () {
    return simulateAndWaitForLine((spec) => {
      const path = { file: 'file', path: ['suite_name', 'test'] };

      spec.registerTests([path], { ...REG_OPTS, slowThreshold: 100 }, DATE);
      spec.gotMessage(path, { type: 'start' }, DATE);
      spec.gotMessage(path, { type: 'error', in: 'uncaught', stack: 'an_error' }, DATE);
      spec.gotMessage(path, { type: 'finish', result: 'failure' }, DATE);
      spec.done(DATE);
    }, /Uncaught error: an_error/);
  });

  it('should print to stdout by default', function () {
    const out = through();
    const outputPromise = waitForStreamToEmitLines(out, [/./, /suite_name/, /test/]);

    // This test can't be done within the test process, because when the test
    // runs in Mocha it's not ok to pipe stdout to something else.
    const suitePromise = suiteRunner({
      files: [`${__dirname}/../../data/suite/suite_spec_should_print_to_stdout_by_default`],
      timeout: 1000,
      reporters: new OnMessage((_, message) => {
        if (message.type === 'finish') {
          out.end();
        } else if (message.type === 'stdout') {
          out.write(message.data);
        }
      }),
      internalErrorOutput: through(),
    });

    return Promise.all([suitePromise, outputPromise]);
  });
});
