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

'use strict';

var expect = require('chai').expect;
var overman = require('../dist/overman');
var reporters = require('../dist/reporters');
var TestFailureError = require('../dist/test_failure_error');

describe('Overman public module', function () {
  it('should invoke the suite runner when called', function (done) {
    overman({
      files: [__dirname + '/../test/suite/suite_test_title'],
      reporters: [
        {
          registerTests: function (tests, options, time) {
            expect(tests).to.be.deep.equal([
              {
                file: __dirname + '/../test/suite/suite_test_title',
                path: ['should succeed'],
              },
            ]);
            expect(options).to.have.property('timeout');
            expect(time).to.be.instanceof(Date);
            done();
          },
        },
      ],
    });
  });

  it('should export reporters', function () {
    expect(overman.reporters).to.be.equal(reporters);
  });

  it('should export TestFailureError', function () {
    expect(overman.TestFailureError).to.be.equal(TestFailureError);
  });
});
