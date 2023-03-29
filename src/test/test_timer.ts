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

import { EventEmitter } from 'events';
import { expect } from 'chai';
import makeFakeClock from './util/fake_clock';
import OnMessage from './util/on_message';
import FakeReporter from '../fakes/fake_reporter';
import Timer from '../reporters/timer';
import { RegisterOptions } from '../reporters/reporter';
import { TestPath } from '../test_path';
import { Message } from '../reporters/message';

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

describe('Timer reporter', function () {
  let clock: ReturnType<typeof makeFakeClock>;
  let messages: EventEmitter;
  let timer: Timer;
  const slowThreshold = 1000;

  beforeEach(function () {
    clock = makeFakeClock();
    messages = new EventEmitter();
    timer = new Timer(new OnMessage(messages.emit.bind(messages, 'message')));
    timer.registerTests([], { ...REG_OPTS, slowThreshold }, DATE);
  });

  describe('Forwarding', function () {
    const reporter = new FakeReporter();

    it('should forward registerTests calls', function () {
      const timer = new Timer(reporter);
      timer.registerTests([TEST_PATH], REG_OPTS, DATE);
      expect(reporter.registerTestsCalls).to.deep.equal([[[TEST_PATH], REG_OPTS, DATE]]);
    });

    it('should forward registrationFailed calls', function () {
      const timer = new Timer(reporter);
      timer.registrationFailed(REG_ERR, DATE);
      expect(reporter.registrationFailedCalls).to.deep.equal([[REG_ERR, DATE]]);
    });

    it('should forward gotMessage calls', function () {
      const timer = new Timer(reporter);
      timer.gotMessage(TEST_PATH, MESSAGE, DATE);
      expect(reporter.gotMessageCalls).to.deep.equal([[TEST_PATH, MESSAGE, DATE]]);
    });

    it('should forward done calls', function () {
      const timer = new Timer(reporter);
      timer.done(DATE);
      expect(reporter.doneCalls).to.deep.equal([[DATE]]);
    });
  });

  describe('Time', function () {
    it('should add time to finish messages', function (done) {
      messages.on('message', (_, message) => {
        if (message.type === 'finish') {
          expect(message).property('duration').to.be.equal(100);
          done();
        }
      });

      timer.gotMessage(TEST_PATH, { type: 'start' }, clock.clock());
      clock.step(10);
      timer.gotMessage(TEST_PATH, { type: 'startedTest' }, clock.clock());
      clock.step(100);
      timer.gotMessage(TEST_PATH, { type: 'startedAfterHooks' }, clock.clock());
      clock.step(1000);
      timer.gotMessage(TEST_PATH, { type: 'finish', result: 'success' }, clock.clock());
    });

    it('should not crash when receiving mismatched finish message', function (done) {
      messages.on('message', (_, message) => {
        if (message.type === 'finish') {
          done();
        }
      });

      timer.gotMessage(TEST_PATH, { type: 'finish', result: 'success' }, clock.clock());
    });
  });

  describe('slow and halfSlow', function () {
    [true, false].forEach(function (shouldEmitSetSlowThresholdMessage) {
      it(
        'should not mark fast test as slow or halfSlow' +
          (shouldEmitSetSlowThresholdMessage ? ' when slow threshold is modified' : ''),
        function (done) {
          messages.on('message', (_, message) => {
            if (message.type === 'finish') {
              expect(message).property('slow').to.be.false;
              expect(message).property('halfSlow').to.be.false;
              done();
            }
          });

          timer.gotMessage(TEST_PATH, { type: 'start' }, clock.clock());
          if (shouldEmitSetSlowThresholdMessage) {
            timer.gotMessage(TEST_PATH, { type: 'setSlowThreshold', value: 2000 }, clock.clock());
          }
          timer.gotMessage(TEST_PATH, { type: 'startedTest' }, clock.clock());
          clock.step(shouldEmitSetSlowThresholdMessage ? 999 : 499);
          timer.gotMessage(TEST_PATH, { type: 'startedAfterHooks' }, clock.clock());
          timer.gotMessage(TEST_PATH, { type: 'finish', result: 'success' }, clock.clock());
        }
      );

      it(
        'should not mark half-slow test as halfSlow' +
          (shouldEmitSetSlowThresholdMessage ? ' when slow threshold is modified' : ''),
        function (done) {
          messages.on('message', (_, message) => {
            if (message.type === 'finish') {
              expect(message).property('slow').to.be.false;
              expect(message).property('halfSlow').to.be.true;
              done();
            }
          });

          timer.gotMessage(TEST_PATH, { type: 'start' }, clock.clock());
          timer.gotMessage(TEST_PATH, { type: 'startedTest' }, clock.clock());
          if (shouldEmitSetSlowThresholdMessage) {
            timer.gotMessage(TEST_PATH, { type: 'setSlowThreshold', value: 500 }, clock.clock());
          }
          clock.step(shouldEmitSetSlowThresholdMessage ? 250 : 500);
          timer.gotMessage(TEST_PATH, { type: 'startedAfterHooks' }, clock.clock());
          timer.gotMessage(TEST_PATH, { type: 'finish', result: 'success' }, clock.clock());
        }
      );

      it(
        'should not mark slow test as slow and halfSlow' +
          (shouldEmitSetSlowThresholdMessage ? ' when slow threshold is modified' : ''),
        function (done) {
          messages.on('message', (_, message) => {
            if (message.type === 'finish') {
              expect(message).property('slow').to.be.true;
              expect(message).property('halfSlow').to.be.true;
              done();
            }
          });

          timer.gotMessage(TEST_PATH, { type: 'start' }, clock.clock());
          if (shouldEmitSetSlowThresholdMessage) {
            timer.gotMessage(TEST_PATH, { type: 'setSlowThreshold', value: 2000 }, clock.clock());
          }
          timer.gotMessage(TEST_PATH, { type: 'startedTest' }, clock.clock());
          clock.step(shouldEmitSetSlowThresholdMessage ? 2000 : 1000);
          timer.gotMessage(TEST_PATH, { type: 'startedAfterHooks' }, clock.clock());
          timer.gotMessage(TEST_PATH, { type: 'finish', result: 'success' }, clock.clock());
        }
      );
    });
  });
});
