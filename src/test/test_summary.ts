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

import * as through from 'through';
import { RegisterOptions } from '../reporters/reporter';
import Summary from '../reporters/summary';
import { TestPath } from '../test_path';
import makeFakeClock from './util/fake_clock';
import { stripAnsiStream, waitForStreamToEmitLines } from './util/stream';

const TEST_PATH: TestPath = { file: 'file', path: [] };
const REG_OPTS: RegisterOptions = {
  timeout: 0,
  listingTimeout: 0,
  slowThreshold: 0,
  graceTime: 0,
  attempts: 0,
};

function performActionsAndCheckOutput(
  actions: (_: Summary) => void,
  output: (string | RegExp)[],
  { dontStrip = false }: { dontStrip?: boolean } = {}
) {
  const stripped = dontStrip ? through() : stripAnsiStream();
  const summary = new Summary(stripped);

  const promise = waitForStreamToEmitLines(stripped, output);

  actions(summary);

  stripped.end();

  return promise;
}

describe('Summary reporter', function () {
  it('should always report passing tests, even when no tests pass', function () {
    const { clock } = makeFakeClock();
    return performActionsAndCheckOutput(
      (summary) => {
        summary.registerTests([], REG_OPTS, clock());
        summary.done(clock());
      },
      ['', /0 passing/, '']
    );
  });

  it('should report number of passed tests', function () {
    const { clock } = makeFakeClock();
    return performActionsAndCheckOutput(
      (summary) => {
        summary.registerTests([], REG_OPTS, clock());
        summary.gotMessage(TEST_PATH, { type: 'finish', result: 'success' });
        summary.done(clock());
      },
      ['', /1 passing/, '']
    );
  });

  it('should report total time it took for tests to run', function () {
    const { clock, step } = makeFakeClock();
    return performActionsAndCheckOutput(
      (summary) => {
        summary.registerTests([], REG_OPTS, clock());
        step(4000);
        summary.done(clock());
      },
      ['', /(4s)/, '']
    );
  });

  it('should report number of skipped tests', function () {
    const { clock } = makeFakeClock();
    return performActionsAndCheckOutput(
      (summary) => {
        summary.registerTests([], REG_OPTS, clock());
        summary.gotMessage(TEST_PATH, { type: 'finish', result: 'skipped' });
        summary.done(clock());
      },
      ['', /0 passing/, /1 skipped/, '']
    );
  });

  it('should report number of aborted tests', function () {
    const { clock } = makeFakeClock();
    return performActionsAndCheckOutput(
      (summary) => {
        summary.registerTests([], REG_OPTS, clock());
        summary.gotMessage(TEST_PATH, { type: 'finish', result: 'aborted' });
        summary.done(clock());
      },
      ['', /0 passing/, /1 aborted/, '']
    );
  });

  it('should report number of failing tests', function () {
    const { clock } = makeFakeClock();
    return performActionsAndCheckOutput(
      (summary) => {
        summary.registerTests([], REG_OPTS, clock());
        summary.gotMessage(TEST_PATH, { type: 'finish', result: 'failure' });
        summary.done(clock());
      },
      ['', /0 passing/, /1 failing/, '']
    );
  });

  it('should report number of tests that time out', function () {
    const { clock } = makeFakeClock();
    return performActionsAndCheckOutput(
      (summary) => {
        summary.registerTests([], REG_OPTS, clock());
        summary.gotMessage(TEST_PATH, { type: 'finish', result: 'timeout' });
        summary.done(clock());
      },
      ['', /0 passing/, /1 failing/, '']
    );
  });

  it('should report number of skipped, timed out and number of failing tests', function () {
    const { clock } = makeFakeClock();
    return performActionsAndCheckOutput(
      (summary) => {
        summary.registerTests([], REG_OPTS, clock());
        summary.gotMessage(TEST_PATH, { type: 'finish', result: 'failure' });
        summary.gotMessage(TEST_PATH, { type: 'finish', result: 'skipped' });
        summary.gotMessage(TEST_PATH, { type: 'finish', result: 'timeout' });
        summary.done(clock());
      },
      ['', /0 passing/, /1 skipped/, /2 failing/, '']
    );
  });

  it('should report number of skipped, aborted, timed out and number of failing tests', function () {
    const { clock } = makeFakeClock();
    return performActionsAndCheckOutput(
      (summary) => {
        summary.registerTests([], REG_OPTS, clock());
        summary.gotMessage(TEST_PATH, { type: 'finish', result: 'failure' });
        summary.gotMessage(TEST_PATH, { type: 'finish', result: 'skipped' });
        summary.gotMessage(TEST_PATH, { type: 'finish', result: 'aborted' });
        summary.gotMessage(TEST_PATH, { type: 'finish', result: 'timeout' });
        summary.done(clock());
      },
      ['', /0 passing/, /1 skipped/, /2 failing/, /1 aborted/, '']
    );
  });

  it('should color the passing tests text', function () {
    const { clock } = makeFakeClock();
    return performActionsAndCheckOutput(
      (summary) => {
        summary.registerTests([], REG_OPTS, clock());
        summary.done(clock());
      },
      ['', new RegExp('\u001b\\[32m0 passing\u001b\\[39m'), ''],
      { dontStrip: true }
    );
  });

  it('should color the test time text', function () {
    const { clock } = makeFakeClock();
    return performActionsAndCheckOutput(
      (summary) => {
        summary.registerTests([], REG_OPTS, clock());
        summary.done(clock());
      },
      ['', new RegExp('\u001b\\[90m\\(0s\\)\u001b\\[39m'), ''],
      { dontStrip: true }
    );
  });

  it('should color the skipped tests text', function () {
    const { clock } = makeFakeClock();
    return performActionsAndCheckOutput(
      (summary) => {
        summary.registerTests([], REG_OPTS, clock());
        summary.gotMessage(TEST_PATH, { type: 'finish', result: 'skipped' });
        summary.done(clock());
      },
      ['', /passing/, new RegExp('\u001b\\[36m1 skipped\u001b\\[39m'), ''],
      { dontStrip: true }
    );
  });

  it('should color the aborted tests text', function () {
    const { clock } = makeFakeClock();
    return performActionsAndCheckOutput(
      (summary) => {
        summary.registerTests([], REG_OPTS, clock());
        summary.gotMessage(TEST_PATH, { type: 'finish', result: 'aborted' });
        summary.done(clock());
      },
      ['', /passing/, new RegExp('\u001b\\[33m1 aborted\u001b\\[39m'), ''],
      { dontStrip: true }
    );
  });

  it('should color the failing tests text', function () {
    const { clock } = makeFakeClock();
    return performActionsAndCheckOutput(
      (summary) => {
        summary.registerTests([], REG_OPTS, clock());
        summary.gotMessage(TEST_PATH, { type: 'finish', result: 'failure' });
        summary.done(clock());
      },
      ['', /passing/, new RegExp('\u001b\\[31m1 failing\u001b\\[39m'), ''],
      { dontStrip: true }
    );
  });
});
