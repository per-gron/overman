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
var testPathUtil = require('../dist/test_path_util');

describe('Test path util', function () {
  it('should return the parent path of a test path', function () {
    expect(testPathUtil.suitePathOf({ path: ['a'], file: 'file' })).to.be.deep.equal({
      path: [],
      file: 'file',
    });
  });

  it('should return null for root paths', function () {
    expect(testPathUtil.suitePathOf({ path: [], file: 'file' })).to.be.null;
  });
});
