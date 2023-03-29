/*
 * Copyright 2014, 2016 Per Eckerdal
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
import Combined from '../reporters/combined';
import { Message } from '../reporters/message';
import { RegisterOptions } from '../reporters/reporter';
import { TestPath } from '../test_path';

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

const reporter1 = new FakeReporter();
const reporter2 = new FakeReporter();

describe('Combined reporter', function () {
  describe('registerTests', function () {
    it(`should not forward registerTests calls when it has no reporters`, function () {
      new Combined([]).registerTests([TEST_PATH], REG_OPTS, DATE);
    });

    it(`should forward registerTests calls`, function () {
      new Combined([reporter1]).registerTests([TEST_PATH], REG_OPTS, DATE);
      expect(reporter1.registerTestsCalls).to.deep.equal([[[TEST_PATH], REG_OPTS, DATE]]);
    });

    it(`should not forward registerTests calls when reporter doesn't implement it`, function () {
      new Combined([{}]).registerTests([TEST_PATH], REG_OPTS, DATE);
    });

    it(`should forward registerTests calls to multiple reporters`, function () {
      new Combined([reporter1, reporter2]).registerTests([TEST_PATH], REG_OPTS, DATE);

      expect(reporter1.registerTestsCalls).to.deep.equal([[[TEST_PATH], REG_OPTS, DATE]]);
      expect(reporter2.registerTestsCalls).to.deep.equal([[[TEST_PATH], REG_OPTS, DATE]]);
    });
  });

  describe('registrationFailed', function () {
    it(`should not forward registrationFailed calls when it has no reporters`, function () {
      new Combined([]).registrationFailed(REG_ERR, DATE);
    });

    it(`should forward registrationFailed calls`, function () {
      new Combined([reporter1]).registrationFailed(REG_ERR, DATE);
      expect(reporter1.registrationFailedCalls).to.deep.equal([[REG_ERR, DATE]]);
    });

    it(`should not forward registrationFailed calls when reporter doesn't implement it`, function () {
      new Combined([{}]).registrationFailed(REG_ERR, DATE);
    });

    it(`should forward registrationFailed calls to multiple reporters`, function () {
      new Combined([reporter1, reporter2]).registrationFailed(REG_ERR, DATE);

      expect(reporter1.registrationFailedCalls).to.deep.equal([[REG_ERR, DATE]]);
      expect(reporter2.registrationFailedCalls).to.deep.equal([[REG_ERR, DATE]]);
    });
  });

  describe('gotMessage', function () {
    it(`should not forward gotMessage calls when it has no reporters`, function () {
      new Combined([]).gotMessage(TEST_PATH, MESSAGE, DATE);
    });

    it(`should forward gotMessage calls`, function () {
      new Combined([reporter1]).gotMessage(TEST_PATH, MESSAGE, DATE);
      expect(reporter1.gotMessageCalls).to.deep.equal([[TEST_PATH, MESSAGE, DATE]]);
    });

    it(`should not forward gotMessage calls when reporter doesn't implement it`, function () {
      new Combined([{}]).gotMessage(TEST_PATH, MESSAGE, DATE);
    });

    it(`should forward gotMessage calls to multiple reporters`, function () {
      new Combined([reporter1, reporter2]).gotMessage(TEST_PATH, MESSAGE, DATE);

      expect(reporter1.gotMessageCalls).to.deep.equal([[TEST_PATH, MESSAGE, DATE]]);
      expect(reporter2.gotMessageCalls).to.deep.equal([[TEST_PATH, MESSAGE, DATE]]);
    });
  });

  describe('done', function () {
    it(`should not forward done calls when it has no reporters`, function () {
      new Combined([]).done(DATE);
    });

    it(`should forward done calls`, function () {
      new Combined([reporter1]).done(DATE);
      expect(reporter1.doneCalls).to.deep.equal([[DATE]]);
    });

    it(`should not forward done calls when reporter doesn't implement it`, function () {
      new Combined([{}]).done(DATE);
    });

    it(`should forward done calls to multiple reporters`, function () {
      new Combined([reporter1, reporter2]).done(DATE);

      expect(reporter1.doneCalls).to.deep.equal([[DATE]]);
      expect(reporter2.doneCalls).to.deep.equal([[DATE]]);
    });
  });
});
