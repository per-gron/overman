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

describe('A suite', function () {
  expect(this.timeout()).to.be.null;
  this.timeout(1234);
  expect(this.timeout()).to.be.equal(1234);

  describe('A subsuite', function () {
    expect(this.timeout()).to.be.equal(1234);
    this.timeout(2345);
    expect(this.timeout()).to.be.equal(2345);
  });

  expect(this.timeout()).to.be.equal(1234);
});
