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
import overman, {
  reporters as overmanReporters,
  TestFailureError as overmanTestFailureError,
} from '..';
import * as reporters from '../reporters';
import Reporter from '../reporters/reporter';
import * as TestFailureError from '../test_failure_error';

describe('Overman public module', function () {
  it('should invoke the suite runner when called', function (done) {
    const reporter: Reporter = {
      registerTests(tests, options, time) {
        expect(tests).to.be.deep.equal([
          {
            file: `${__dirname}/../../data/suite/suite_test_title`,
            path: ['should succeed'],
          },
        ]);
        expect(options).to.have.property('timeout');
        expect(time).to.be.instanceof(Date);
        done();
      },
    };
    overman({
      files: [`${__dirname}/../../data/suite/suite_test_title`],
      reporters: [reporter],
    });
  });

  it('should export reporters', function () {
    expect(overmanReporters).to.be.equal(reporters);
  });

  it('should export TestFailureError', function () {
    expect(overmanTestFailureError).to.be.equal(TestFailureError);
  });
});
