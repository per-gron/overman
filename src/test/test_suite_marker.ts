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

import { expect } from 'chai';
import FakeReporter from '../fakes/fake_reporter';
import { Message, MessageWithSlowness } from '../reporters/message';
import { RegisterOptions } from '../reporters/reporter';
import SuiteMarker from '../reporters/suite_marker';
import { TestPath } from '../test_path';
import OnMessage from './util/on_message';

const TEST_PATH: TestPath = { file: 'file1', path: [] };
const REG_OPTS: RegisterOptions = {
  timeout: 0,
  listingTimeout: 0,
  slowThreshold: 0,
  graceTime: 0,
  attempts: 0,
};
const REG_ERR = new Error('registrationFailed');
const MESSAGE: Message = { type: 'start' };
const DATE = new Date(42);

describe('SuiteMarker reporter', function () {
  describe('Forwarding', function () {
    const reporter = new FakeReporter();

    it('should forward registerTests calls', function () {
      const suiteMarker = new SuiteMarker(reporter);
      suiteMarker.registerTests([TEST_PATH], REG_OPTS, DATE);
      expect(reporter.registerTestsCalls).to.deep.equal([[[TEST_PATH], REG_OPTS, DATE]]);
    });

    it('should forward registrationFailed calls', function () {
      const suiteMarker = new SuiteMarker(reporter);
      suiteMarker.registerTests([TEST_PATH], REG_OPTS, DATE);
      suiteMarker.registrationFailed(REG_ERR, DATE);
      expect(reporter.registrationFailedCalls).to.deep.equal([[REG_ERR, DATE]]);
    });

    it('should forward gotMessage calls', function () {
      const suiteMarker = new SuiteMarker(reporter);
      suiteMarker.registerTests([TEST_PATH], REG_OPTS, DATE);
      suiteMarker.gotMessage(TEST_PATH, MESSAGE, DATE);
      expect(reporter.gotMessageCalls).to.deep.equal([[TEST_PATH, MESSAGE, DATE]]);
    });

    it('should forward done calls', function () {
      const suiteMarker = new SuiteMarker(reporter);
      suiteMarker.registerTests([TEST_PATH], REG_OPTS, DATE);
      suiteMarker.done(DATE);
      expect(reporter.doneCalls).to.deep.equal([[DATE]]);
    });
  });

  function testSuiteMarker(
    paths: TestPath[],
    actions: { expect?: unknown[]; emit: { testPath: TestPath; message: MessageWithSlowness } }[]
  ) {
    let expectations: unknown[] | null = null;
    const suiteMarker = new SuiteMarker(
      new OnMessage(function (testPath, message) {
        if (expectations === null) {
          return;
        }

        const args = {
          testPath: testPath,
          message: message,
        };

        expect(
          expectations,
          'did not expect a message (got ' + JSON.stringify(args) + ')'
        ).to.not.be.empty;

        expect(args).to.be.deep.equal(expectations.shift());
      })
    );

    function updateExpectations(newExpectations: unknown[] | null) {
      if (expectations !== null) {
        expect(expectations, 'expectations need to be fulfilled').to.be.empty;
      }
      expectations = newExpectations;
    }

    suiteMarker.registerTests(paths, REG_OPTS, DATE);

    actions.forEach((action) => {
      updateExpectations(action.expect || null);
      suiteMarker.gotMessage(action.emit.testPath, action.emit.message, DATE);
    });

    updateExpectations(null);
  }

  describe('suiteStart', function () {
    it('should emit suiteStart message', function () {
      const path = { file: 'file', path: ['test'] };
      const suitePath = { file: 'file', path: [] };

      testSuiteMarker(
        [path],
        [
          {
            emit: { testPath: path, message: { type: 'start' } },
            expect: [
              { testPath: suitePath, message: { type: 'suiteStart', suite: suitePath } },
              { testPath: path, message: { type: 'start' } },
            ],
          },
        ]
      );
    });

    it('should emit suiteStart message with time parameter', function (done) {
      const path = { file: 'file', path: ['test'] };
      const time = new Date();

      const suiteMarker = new SuiteMarker(
        new OnMessage((_, message, recievedTime) => {
          if (message.type === 'suiteStart') {
            expect(recievedTime).to.be.deep.equal(time);
            done();
          }
        })
      );

      suiteMarker.registerTests([path], REG_OPTS, DATE);
      suiteMarker.gotMessage(path, { type: 'start' }, time);
    });

    it('should emit suiteStart message only for the first test in a suite', function () {
      const path1 = { file: 'file', path: ['test1'] };
      const path2 = { file: 'file', path: ['test2'] };
      const suitePath = { file: 'file', path: [] };

      testSuiteMarker(
        [path1, path2],
        [
          {
            emit: { testPath: path1, message: { type: 'start' } },
            expect: [
              { testPath: suitePath, message: { type: 'suiteStart', suite: suitePath } },
              { testPath: path1, message: { type: 'start' } },
            ],
          },
          {
            emit: { testPath: path1, message: { type: 'finish', result: 'success' } },
            expect: [{ testPath: path1, message: { type: 'finish', result: 'success' } }],
          },
          {
            emit: { testPath: path2, message: { type: 'start' } },
            expect: [{ testPath: path2, message: { type: 'start' } }],
          },
        ]
      );
    });

    it('should emit suiteStart message only for the first test in a suite, even when tests are run in parallel', function () {
      const path1 = { file: 'file', path: ['test1'] };
      const path2 = { file: 'file', path: ['test2'] };
      const suitePath = { file: 'file', path: [] };

      testSuiteMarker(
        [path1, path2],
        [
          {
            emit: { testPath: path1, message: { type: 'start' } },
            expect: [
              { testPath: suitePath, message: { type: 'suiteStart', suite: suitePath } },
              { testPath: path1, message: { type: 'start' } },
            ],
          },
          {
            emit: { testPath: path2, message: { type: 'start' } },
            expect: [{ testPath: path2, message: { type: 'start' } }],
          },
        ]
      );
    });

    it('should emit suiteStart messages for ancestor tests as well when needed', function () {
      const path = { file: 'file', path: ['suite', 'test1'] };
      const suitePath1 = { file: 'file', path: [] };
      const suitePath2 = { file: 'file', path: ['suite'] };

      testSuiteMarker(
        [path],
        [
          {
            emit: { testPath: path, message: { type: 'start' } },
            expect: [
              { testPath: suitePath1, message: { type: 'suiteStart', suite: suitePath1 } },
              { testPath: suitePath2, message: { type: 'suiteStart', suite: suitePath2 } },
              { testPath: path, message: { type: 'start' } },
            ],
          },
        ]
      );
    });
  });

  describe('suiteFinish', function () {
    it('should emit suiteFinish message', function () {
      const path = { file: 'file', path: ['test'] };
      const suitePath = { file: 'file', path: [] };

      testSuiteMarker(
        [path],
        [
          { emit: { testPath: path, message: { type: 'start' } } },
          {
            emit: { testPath: path, message: { type: 'finish', result: 'success' } },
            expect: [
              { testPath: path, message: { type: 'finish', result: 'success' } },
              { testPath: suitePath, message: { type: 'suiteFinish', suite: suitePath } },
            ],
          },
        ]
      );
    });

    it('should emit suiteFinish message with time parameter', function (done) {
      const path = { file: 'file', path: ['test'] };

      const suiteMarker = new SuiteMarker(
        new OnMessage((_, message, recievedTime) => {
          if (message.type === 'suiteFinish') {
            expect(recievedTime).to.be.deep.equal(DATE);
            done();
          }
        })
      );

      suiteMarker.registerTests([path], REG_OPTS, DATE);
      suiteMarker.gotMessage(path, { type: 'start' }, DATE);
      suiteMarker.gotMessage(path, { type: 'finish', result: 'success' }, DATE);
    });

    it('should emit suiteFinish message when all tests in the suite are finished', function () {
      const path1 = { file: 'file', path: ['test1'] };
      const path2 = { file: 'file', path: ['test2'] };
      const suitePath = { file: 'file', path: [] };

      testSuiteMarker(
        [path1, path2],
        [
          { emit: { testPath: path1, message: { type: 'start' } } },
          {
            emit: { testPath: path1, message: { type: 'finish', result: 'success' } },
            expect: [{ testPath: path1, message: { type: 'finish', result: 'success' } }],
          },
          { emit: { testPath: path2, message: { type: 'start' } } },
          {
            emit: { testPath: path2, message: { type: 'finish', result: 'success' } },
            expect: [
              { testPath: path2, message: { type: 'finish', result: 'success' } },
              { testPath: suitePath, message: { type: 'suiteFinish', suite: suitePath } },
            ],
          },
        ]
      );
    });

    it('should emit suiteFinish message when all tests, including tests in subsuites, are finished', function () {
      const path1 = { file: 'file', path: ['test1'] };
      const suitePath1 = { file: 'file', path: [] };
      const path2 = { file: 'file', path: ['suite', 'test2'] };
      const suitePath2 = { file: 'file', path: ['suite'] };

      testSuiteMarker(
        [path1, path2],
        [
          { emit: { testPath: path1, message: { type: 'start' } } },
          {
            emit: { testPath: path1, message: { type: 'finish', result: 'success' } },
            expect: [{ testPath: path1, message: { type: 'finish', result: 'success' } }],
          },
          { emit: { testPath: path2, message: { type: 'start' } } },
          {
            emit: { testPath: path2, message: { type: 'finish', result: 'success' } },
            expect: [
              { testPath: path2, message: { type: 'finish', result: 'success' } },
              { testPath: suitePath2, message: { type: 'suiteFinish', suite: suitePath2 } },
              { testPath: suitePath1, message: { type: 'suiteFinish', suite: suitePath1 } },
            ],
          },
        ]
      );
    });
  });
});
