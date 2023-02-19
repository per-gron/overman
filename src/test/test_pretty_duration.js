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
var prettyDuration = require('../pretty_duration');

describe('Pretty duration', function () {
  it('should properly handle zero', function () {
    expect(prettyDuration(0)).to.be.equal('0s');
  });

  it('should properly handle short times', function () {
    expect(prettyDuration(110)).to.be.equal('0s');
  });

  it('should report seconds', function () {
    expect(prettyDuration(2345)).to.be.equal('2s');
  });

  it('should report minutes', function () {
    expect(prettyDuration(120001)).to.be.equal('2m');
  });

  it('should report hours', function () {
    expect(prettyDuration(7199999)).to.be.equal('2h');
  });

  it('should report minutes and seconds', function () {
    expect(prettyDuration(100001)).to.be.equal('2m 40s');
  });

  it('should report hours and seconds', function () {
    expect(prettyDuration(3601000)).to.be.equal('1h 1s');
  });

  it('should report hours and minutes and seconds', function () {
    expect(prettyDuration(3801000)).to.be.equal('1h 3m 21s');
  });
});