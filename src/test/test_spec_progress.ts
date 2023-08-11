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

import { expect } from 'chai';
import stripAnsi = require('strip-ansi');
import SpecProgress, { InsertionLogLike } from '../reporters/spec_progress';
import * as through from 'through';
import { TestPath } from '../test_path';
import { FinishMessage, MessageWithSlowness } from '../reporters/message';

const TEST_PATH: TestPath = { file: 'file', path: [] };
const DATE = new Date(42);

const NOP = () => {};

class FakeInsertionLog implements InsertionLogLike {
  log: InsertionLogLike['log'];
  logAfter: InsertionLogLike['logAfter'];
  replace: InsertionLogLike['replace'];
  constructor({ log = NOP, logAfter = NOP, replace = NOP }: Partial<InsertionLogLike> = {}) {
    this.log = log;
    this.logAfter = logAfter;
    this.replace = replace;
  }
}

describe('Spec progress reporter', function () {
  describe('Constructor', function () {
    it('should pass stream to the InsertionLog', function () {
      return new Promise<void>((resolve) => {
        const stream = through();
        new SpecProgress({ stdout: stream }, (inStream) => {
          expect(stream).to.be.equal(inStream);
          resolve();
          return new FakeInsertionLog();
        });
      });
    });
  });

  describe('Suites', function () {
    function verifySuiteStartLog(path: string[], expectedOutput: string) {
      return new Promise<void>((resolve) => {
        const reporter = new SpecProgress(
          { stdout: through() },
          () =>
            new FakeInsertionLog({
              log(msg) {
                expect(msg).to.be.equal(expectedOutput);
                resolve();
              },
            })
        );

        const suitePath: TestPath = { file: 'file', path };
        reporter.gotMessage(TEST_PATH, { type: 'suiteStart', suite: suitePath }, DATE);
      });
    }

    it('should log suite name on suiteStart messages', function () {
      return verifySuiteStartLog(['suite'], '  suite');
    });

    it('should log suite name on suiteStart messages for the root suite', function () {
      return verifySuiteStartLog([], '');
    });
  });

  describe('Test start', function () {
    it('should log first test name after suite name', function () {
      let suiteLineId: string | undefined;

      return new Promise<void>((resolve) => {
        const reporter = new SpecProgress(
          { stdout: through() },
          () =>
            new FakeInsertionLog({
              log(_, id) {
                suiteLineId = id;
              },
              logAfter(afterId, line) {
                expect(suiteLineId).not.to.be.null;
                expect(suiteLineId).to.be.equal(afterId);
                expect(stripAnsi(line)).to.be.equal('    test');
                resolve();
              },
            })
        );

        const suitePath = { file: 'file', path: [] };
        const testPath = { file: 'file', path: ['test'] };
        reporter.gotMessage(suitePath, { type: 'suiteStart', suite: suitePath }, DATE);
        reporter.gotMessage(testPath, { type: 'start' }, DATE);
      });
    });

    it('should log second test name after first test name', function () {
      let suiteLineId: string | undefined;
      let test1LineId: string | undefined;

      return new Promise<void>((resolve) => {
        const reporter = new SpecProgress(
          { stdout: through() },
          () =>
            new FakeInsertionLog({
              log(_, id) {
                suiteLineId = id;
              },
              logAfter(afterId, line, id) {
                expect(afterId).not.to.be.null;

                if (afterId === suiteLineId) {
                  expect(stripAnsi(line)).to.contain('test1');
                  test1LineId = id;
                } else {
                  expect(afterId).to.be.equal(test1LineId);
                  expect(stripAnsi(line)).to.contain('test2');
                  resolve();
                }
              },
            })
        );

        const suitePath = { file: 'file', path: [] };
        const testPath1 = { file: 'file', path: ['test1'] };
        const testPath2 = { file: 'file', path: ['test2'] };
        reporter.gotMessage(suitePath, { type: 'suiteStart', suite: suitePath }, DATE);
        reporter.gotMessage(testPath1, { type: 'start' }, DATE);
        reporter.gotMessage(testPath2, { type: 'start' }, DATE);
      });
    });
  });

  describe('Test breadcrumb', function () {
    it('should emit breadcrumbs', function () {
      let testLineId: string | undefined;

      return new Promise<void>((resolve) => {
        const reporter = new SpecProgress(
          { stdout: through() },
          () =>
            new FakeInsertionLog({
              logAfter(_, line, id) {
                expect(stripAnsi(line)).to.contain('test');
                testLineId = id;
              },
              replace(replacedId, line) {
                expect(testLineId).to.not.be.null;
                expect(replacedId).to.be.equal(testLineId);
                expect(stripAnsi(line)).to.be.equal('    test  >  [0.0s]: 42');
                resolve();
              },
            })
        );

        const suitePath = { file: 'file', path: [] };
        const testPath = { file: 'file', path: ['test'] };
        reporter.gotMessage(suitePath, { type: 'suiteStart', suite: suitePath }, DATE);
        reporter.gotMessage(testPath, { type: 'start' }, DATE);
        reporter.gotMessage(testPath, { type: 'breadcrumb', message: '42', trace: '' }, DATE);
      });
    });

    it('should not emit breadcrumbs when disabled', function () {
      let testLineId: string | undefined;

      return new Promise<void>((resolve) => {
        const reporter = new SpecProgress(
          { stdout: through(), disableBreadcrumbs: true },
          () =>
            new FakeInsertionLog({
              logAfter(_, line, id) {
                expect(stripAnsi(line)).to.contain('test');
                testLineId = id;
              },
              replace(replacedId, line) {
                expect(testLineId).to.not.be.null;
                expect(replacedId).to.be.equal(testLineId);
                expect(stripAnsi(line)).to.be.equal('  ✓ test');
                resolve();
              },
            })
        );

        const suitePath = { file: 'file', path: [] };
        const testPath = { file: 'file', path: ['test'] };
        reporter.gotMessage(suitePath, { type: 'suiteStart', suite: suitePath }, DATE);
        reporter.gotMessage(testPath, { type: 'start' }, DATE);
        reporter.gotMessage(testPath, { type: 'breadcrumb', message: '42', trace: '' }, DATE);
        reporter.gotMessage(testPath, { type: 'finish', result: 'success' }, DATE);
      });
    });
  });

  describe('Test finish', function () {
    function verifyTestFinishLog(
      result: FinishMessage['result'],
      expectedOutput?: string,
      extraFinishOptions?: Omit<MessageWithSlowness, 'type' | 'result'>
    ) {
      let testLineId: string | undefined;

      return new Promise<void>((resolve) => {
        const reporter = new SpecProgress(
          { stdout: through() },
          () =>
            new FakeInsertionLog({
              logAfter(_, line, id) {
                expect(stripAnsi(line)).to.contain('test');
                testLineId = id;
              },
              replace(replacedId, line) {
                expect(testLineId).to.not.be.null;
                expect(replacedId).to.be.equal(testLineId);
                expect(stripAnsi(line)).to.be.equal(expectedOutput);
                resolve();
              },
            })
        );

        const suitePath = { file: 'file', path: [] };
        const testPath = { file: 'file', path: ['test'] };
        reporter.gotMessage(suitePath, { type: 'suiteStart', suite: suitePath }, DATE);
        reporter.gotMessage(testPath, { type: 'start' }, DATE);
        reporter.gotMessage(testPath, { ...extraFinishOptions, type: 'finish', result }, DATE);
      });
    }

    it('should replace test name with success test marker', function () {
      return verifyTestFinishLog('success', '  ✓ test');
    });

    it('should replace test name with failure test marker', function () {
      return verifyTestFinishLog('failure', '  ✖ test');
    });

    it('should mark slow tests', function () {
      return verifyTestFinishLog('failure', '  ✖ test (12345ms)', { slow: true, duration: 12345 });
    });
  });

  describe('Stream piping', function () {
    (['stdout', 'stderr'] as const).forEach((streamName) => {
      describe(streamName, function () {
        it('should pipe the output from a test', function (done) {
          let testLineId: string | undefined;
          let testOutputLineId: string | undefined;

          const reporter = new SpecProgress(
            { stdout: through() },
            () =>
              new FakeInsertionLog({
                logAfter(afterId, line, id) {
                  expect(afterId).to.not.be.null;

                  if (line.match(/test/)) {
                    testLineId = id;
                  } else if (afterId === testLineId) {
                    expect(line).to.be.equal('a_line');
                    testOutputLineId = id;
                  } else if (afterId === testOutputLineId) {
                    expect(line).to.be.equal('a_second_line');
                    done();
                  }
                },
              })
          );

          const suitePath = { file: 'file', path: [] };
          const testPath = { file: 'file', path: ['test'] };
          reporter.gotMessage(suitePath, { type: 'suiteStart', suite: suitePath }, DATE);
          reporter.gotMessage(testPath, { type: 'start' }, DATE);

          reporter.gotMessage(
            testPath,
            {
              type: streamName,
              data: 'a_line\n',
            },
            DATE
          );
          reporter.gotMessage(
            testPath,
            {
              type: streamName,
              data: 'a_second_line\n',
            },
            DATE
          );
        });
      });
    });
  });

  it('should do nothing on other messages', function () {
    const reporter = new SpecProgress({ stdout: through() }, () => new FakeInsertionLog());
    const suitePath = { file: 'file', path: [] };
    reporter.gotMessage(suitePath, { type: 'breadcrumb', message: '', trace: '' }, DATE);
  });
});
