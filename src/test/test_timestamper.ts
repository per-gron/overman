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
import { Message } from '../reporters/message';
import { RegisterOptions } from '../reporters/reporter';
import TimestamperReporter from '../reporters/timestamper';
import { TestPath } from '../test_path';

const TEST_PATH: TestPath = { file: '', path: [] };
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

const clock = () => DATE;
const reporter = new FakeReporter();

describe('Timestamper reporter', function () {
  describe('registerTests', function () {
    it(`should forward registerTests calls and append time to the arguments`, function () {
      new TimestamperReporter(reporter, clock).registerTests([TEST_PATH], REG_OPTS);
      expect(reporter.registerTestsCalls).to.deep.equal([[[TEST_PATH], REG_OPTS, DATE]]);
    });

    it(`should not forward registerTests calls when reporter doesn't implement it`, function () {
      new TimestamperReporter({}, clock).registerTests([TEST_PATH], REG_OPTS);
      expect(reporter.registerTestsCalls).to.be.empty;
    });
  });

  describe('registerationFailed', function () {
    it(`should forward registrationFailed calls and append time to the arguments`, function () {
      new TimestamperReporter(reporter, clock).registrationFailed(REG_ERR);
      expect(reporter.registrationFailedCalls).to.deep.equal([[REG_ERR, DATE]]);
    });

    it(`should not forward registrationFailed calls when reporter doesn't implement it`, function () {
      new TimestamperReporter({}, clock).registrationFailed(REG_ERR);
      expect(reporter.registrationFailedCalls).to.be.empty;
    });
  });

  describe('gotMessage', function () {
    it(`should forward gotMessage calls and append time to the arguments`, function () {
      new TimestamperReporter(reporter, clock).gotMessage(TEST_PATH, MESSAGE);
      expect(reporter.gotMessageCalls).to.deep.equal([[TEST_PATH, MESSAGE, DATE]]);
    });

    it(`should not forward gotMessage calls when reporter doesn't implement it`, function () {
      new TimestamperReporter({}, clock).gotMessage(TEST_PATH, MESSAGE);
      expect(reporter.gotMessageCalls).to.be.empty;
    });
  });

  describe('done', function () {
    it(`should forward done calls and append time to the arguments`, function () {
      new TimestamperReporter(reporter, clock).done();
      expect(reporter.doneCalls).to.deep.equal([[DATE]]);
    });

    it(`should not forward done calls when reporter doesn't implement it`, function () {
      new TimestamperReporter({}, clock).done();
      expect(reporter.registerTestsCalls).to.be.empty;
    });
  });
});
