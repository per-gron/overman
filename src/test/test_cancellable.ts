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
import FakeInternalReporter from '../fakes/fake_internal_reporter';
import Cancellable from '../reporters/cancellable';
import { Message } from '../reporters/message';
import { RegisterOptions } from '../reporters/reporter';
import { TestPath } from '../test_path';

const TEST_PATH1: TestPath = { file: 'file1', path: [] };
const TEST_PATH2: TestPath = { file: 'file2', path: [] };
const REG_OPTS: RegisterOptions = {
  timeout: 0,
  listingTimeout: 0,
  slowThreshold: 0,
  graceTime: 0,
  attempts: 0,
};
const REG_ERR = new Error('registrationFailed');
const MESSAGE: Message = { type: 'start' };

const reporter = new FakeInternalReporter();

describe('Cancellable reporter', function () {
  describe('Forwarding', function () {
    it(`should forward registerTests calls`, function () {
      const cancellable = new Cancellable(reporter);
      cancellable.registerTests([TEST_PATH1], REG_OPTS);
      expect(reporter.registerTestsCalls).to.be.deep.equal([[[TEST_PATH1], REG_OPTS]]);
    });

    it(`should not forward registerTests calls after being cancelled`, function () {
      const cancellable = new Cancellable(reporter);
      cancellable.cancel();
      cancellable.registerTests([TEST_PATH1], REG_OPTS);
      expect(reporter.registerTestsCalls).to.be.empty;
    });

    it(`should forward registrationFailed calls`, function () {
      const cancellable = new Cancellable(reporter);
      cancellable.registrationFailed(REG_ERR);
      expect(reporter.registrationFailedCalls).to.be.deep.equal([[REG_ERR]]);
    });

    it(`should not forward registrationFailed calls after being cancelled`, function () {
      const cancellable = new Cancellable(reporter);
      cancellable.cancel();
      cancellable.registrationFailed(REG_ERR);
      expect(reporter.registrationFailedCalls).to.be.empty;
    });

    it(`should forward gotMessage calls`, function () {
      const cancellable = new Cancellable(reporter);
      cancellable.gotMessage(TEST_PATH1, MESSAGE);
      expect(reporter.gotMessageCalls).to.be.deep.equal([[TEST_PATH1, MESSAGE]]);
    });

    it(`should not forward gotMessage calls after being cancelled`, function () {
      const cancellable = new Cancellable(reporter);
      cancellable.cancel();
      cancellable.gotMessage(TEST_PATH1, MESSAGE);
      expect(reporter.gotMessageCalls).to.be.empty;
    });

    it(`should forward done calls`, function () {
      const cancellable = new Cancellable(reporter);
      cancellable.done();
      expect(reporter.doneCalls).to.be.deep.equal([[]]);
    });

    it(`should not forward done calls after being cancelled`, function () {
      const cancellable = new Cancellable(reporter);
      cancellable.cancel();
      cancellable.done();
      expect(reporter.doneCalls).to.be.empty;
    });
  });

  describe('Finished', function () {
    it('should not be finished from the start', function () {
      const cancellable = new Cancellable(reporter);
      expect(cancellable.isFinished()).to.be.false;
    });

    it('should be finished after registrationFailed', function () {
      const cancellable = new Cancellable(reporter);
      cancellable.registrationFailed(new Error('Fail'));
      expect(cancellable.isFinished()).to.be.true;
    });

    it('should not be finished after registerTests', function () {
      const cancellable = new Cancellable(reporter);
      cancellable.registerTests([], REG_OPTS);
      expect(cancellable.isFinished()).to.be.false;
    });

    it('should not be finished after gotMessage', function () {
      const cancellable = new Cancellable(reporter);
      cancellable.gotMessage(TEST_PATH1, { type: 'start' });
      expect(cancellable.isFinished()).to.be.false;
    });

    it('should be finished after done', function () {
      const cancellable = new Cancellable(reporter);
      cancellable.done();
      expect(cancellable.isFinished()).to.be.true;
    });

    it('should be finished after cancel', function () {
      const cancellable = new Cancellable(reporter);
      cancellable.cancel();
      expect(cancellable.isFinished()).to.be.true;
    });
  });

  describe('Cancellation', function () {
    it('should report outstanding tests as aborted when cancelled', function () {
      const cancellable = new Cancellable(reporter);
      cancellable.registerTests([TEST_PATH1, TEST_PATH2], REG_OPTS);
      cancellable.gotMessage(TEST_PATH1, { type: 'start' });
      cancellable.cancel();
      expect(reporter.gotMessageCalls).to.be.deep.equal([
        [TEST_PATH1, { type: 'start' }],
        [TEST_PATH1, { type: 'finish', result: 'aborted' }],
      ]);
    });

    it('should report only outstanding tests as aborted when cancelled', function () {
      const cancellable = new Cancellable(reporter);
      cancellable.registerTests([TEST_PATH1, TEST_PATH2], REG_OPTS);
      cancellable.gotMessage(TEST_PATH1, { type: 'start' });
      cancellable.gotMessage(TEST_PATH2, { type: 'start' });
      cancellable.gotMessage(TEST_PATH1, { type: 'finish', result: 'success' });
      cancellable.cancel();
      expect(reporter.gotMessageCalls).to.be.deep.equal([
        [TEST_PATH1, { type: 'start' }],
        [TEST_PATH2, { type: 'start' }],
        [TEST_PATH1, { type: 'finish', result: 'success' }],
        [TEST_PATH2, { type: 'finish', result: 'aborted' }],
      ]);
    });

    it('should not invoke done unless registerTests has been called', function () {
      const cancellable = new Cancellable(reporter);
      cancellable.cancel();
      expect(reporter.doneCalls).to.be.empty;
    });
  });
});
