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
var TestCount = require('../test_count');

describe('TestCount', function () {
  var testCount = new TestCount();

  beforeEach(function () {
    testCount = new TestCount();
  });

  it("should return 0 when queried for suites that aren't present in the set", function () {
    expect(testCount.numberOfTestsInSuite({ file: 'a', path: ['test'] })).to.be.equal(0);
  });

  it('should add a test', function () {
    testCount.addTest({ file: 'a', path: ['test'] });
    expect(testCount.numberOfTestsInSuite({ file: 'a', path: [] })).to.be.equal(1);
  });

  it('should add a test in a subsuite', function () {
    testCount.addTest({ file: 'a', path: ['suite', 'test'] });
    expect(testCount.numberOfTestsInSuite({ file: 'a', path: ['suite'] })).to.be.equal(1);
  });

  it('should add multiple tests', function () {
    testCount.addTest({ file: 'a', path: ['suite', 'test1'] });
    testCount.addTest({ file: 'a', path: ['suite', 'test2'] });
    expect(testCount.numberOfTestsInSuite({ file: 'a', path: ['suite'] })).to.be.equal(2);
  });

  it('should remove a test', function () {
    testCount.addTest({ file: 'a', path: ['suite', 'test'] });
    testCount.removeTest({ file: 'a', path: ['suite', 'test'] });
    expect(testCount.numberOfTestsInSuite({ file: 'a', path: ['suite'] })).to.be.equal(0);
  });

  it('should keep other tests when removing a test', function () {
    testCount.addTest({ file: 'a', path: ['suite', 'test'] });
    testCount.addTest({ file: 'a', path: ['suite', 'subsuite', 'test'] });
    testCount.removeTest({ file: 'a', path: ['suite', 'test'] });
    expect(testCount.numberOfTestsInSuite({ file: 'a', path: ['suite'] })).to.be.equal(1);
  });

  it('should consider tests in descendant suites as part of a suite', function () {
    testCount.addTest({ file: 'a', path: ['suite', 'subsuite', 'test'] });
    expect(testCount.numberOfTestsInSuite({ file: 'a', path: ['suite'] })).to.be.equal(1);
  });

  it('should consider tests in ancestor suites as part of a suite', function () {
    testCount.addTest({ file: 'a', path: ['suite', 'subsuite', 'test'] });
    testCount.addTest({ file: 'a', path: ['suite', 'test'] });
    expect(testCount.numberOfTestsInSuite({ file: 'a', path: ['suite', 'subsuite'] })).to.be.equal(
      1
    );
  });
});
