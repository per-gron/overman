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
var when = require('when');
var Stopwatch = require('../lib/stopwatch');
var makeFakeClock = require('./util/fake_clock');

describe('Stopwatch', function() {
  var clock;
  var stopwatch;
  beforeEach(function() {
    clock = makeFakeClock();
    stopwatch = new Stopwatch(clock);
  });

  it('should report time since start', function() {
    clock.step(100);
    expect(stopwatch.getTimeSinceStart()).to.be.equal(100);
  });

  it('should throw exception when asked for time since event that has not happened', function() {
    expect(function() {
      stopwatch.getTimeSince('nonexistentEvent');
    }).to.throw(/No registered timestamp for event/);
  });

  it('should report time since event', function() {
    stopwatch.emit('eventName');
    clock.step(200);
    expect(stopwatch.getTimeSince('eventName')).to.be.equal(200);
  });

  it('should report time since last event', function() {
    stopwatch.emit('eventName');
    clock.step(200);
    stopwatch.emit('eventName');
    clock.step(200);
    expect(stopwatch.getTimeSince('eventName')).to.be.equal(200);
  });

  it('should report time since last event with same name', function() {
    stopwatch.emit('eventName1');
    clock.step(200);
    stopwatch.emit('eventName2');
    clock.step(200);
    expect(stopwatch.getTimeSince('eventName1')).to.be.equal(400);
  });

  it('should use wall time as default clock', function() {
    var stopwatch = new Stopwatch();
    return when()
      .delay(300)
      .then(function() {
        expect(stopwatch.getTimeSinceStart()).to.be.within(290, 400);
      });
  });
});
