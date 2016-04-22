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
var TimeoutTimer = require('../lib/timeout_timer');
var makeFakeClock = require('./util/fake_clock');
var delay = require('./util/delay');

describe('TimeoutTimer', function() {
  it('should require timeout parameter', function() {
    expect(function() {
      new TimeoutTimer();
    }).to.throw('missing timeout parameter');
  });

  it('should require numeric timeout parameter', function() {
    expect(function() {
      new TimeoutTimer('123');
    }).to.throw('missing timeout parameter');
  });

  it('should support being created without options parameter', function() {
    new TimeoutTimer(100, { setTimeout: function() {} });
  });

  it('should emit "timeout" event when time is up', function(done) {
    var timeoutFn;
    var timer = new TimeoutTimer(100, {
      setTimeout: function(fn) { timeoutFn = fn; }
    });
    expect(timeoutFn).to.be.a('function');

    timer.on('timeout', function() {
      done();
    });

    timeoutFn();
  });

  it('should not immediately clear the not-yet-armed timeout', function() {
    new TimeoutTimer(100, {
      setTimeout: function() {},
      clearTimeout: function() {
        throw new Error('Should not be called');
      }
    });
  });

  it('should clear the timeout on cancel', function(done) {
    var timeoutToken = ['timeouttoken'];

    var timer = new TimeoutTimer(100, {
      setTimeout: function() { return timeoutToken; },
      clearTimeout: function(token) {
        expect(token).to.be.equal(timeoutToken);
        done();
      }
    });

    timer.cancel();
  });

  it('should set a timeout with the proper time', function(done) {
    new TimeoutTimer(100, {
      clock: function() { return new Date(12345); },
      setTimeout: function(callback, time) {
        expect(time).to.be.equal(100);
        done();
      }
    });
  });

  it('should update the timeout on updateTimeout', function(done) {
    var gotInitialTimeoutCall = false;
    var clock = makeFakeClock();

    var timer = new TimeoutTimer(123, {
      clock: clock,
      setTimeout: function(callback, time) {
        if (!gotInitialTimeoutCall) {
          gotInitialTimeoutCall = true;
          process.nextTick(function() {
            clock.step(111);
            timer.updateTimeout(456);
            callback();
          });
        } else {
          expect(time).to.be.equal(345);
          done();
        }
      }
    });
  });

  it('should refuse to updateTimeout on an elapsed timer', function() {
    var timer = new TimeoutTimer(80, {
      clock: function() { return new Date(321); },
      setTimeout: function(callback) {
        process.nextTick(function() {
          callback();
          expect(function() {
            timer.updateTimeout(654);
          }).to.throw('timer that has elapsed');
        });
      }
    });
  });

  it('should refuse to updateTimeout on a cancelled timer', function() {
    var timer = new TimeoutTimer(80, {
      setTimeout: function() {}
    });

    timer.cancel();
    expect(function() {
      timer.updateTimeout(654);  
    }).to.throw('timer that has elapsed');
  });

  it('should invoke the callback on the next tick when timeout is updated to a time that\'s already passed', function(done) {
    var onTickAfterTimerCreation = false;
    var onInitialTick = true;
    process.nextTick(function() { onInitialTick = false; });

    var timer = new TimeoutTimer(10);
    timer.on('timeout', function() {
      expect(onInitialTick, 'should not be on the initial tick').to.be.false;
      expect(onTickAfterTimerCreation, 'should not have waited longer than one tick').to.be.false;
      done();
    });
    timer.updateTimeout(-10);

    process.nextTick(function() { onTickAfterTimerCreation = true; });
  });

  it('should invoke callback on a separate tick even when the timer is updated to a time in the past', function(done) {
    var onInitialTick = true;
    process.nextTick(function() { onInitialTick = false; });

    var timer = new TimeoutTimer(10);
    timer.on('timeout', function() {
      expect(onInitialTick, 'should not be on the initial tick').to.be.false;
      done();
    });
    timer.updateTimeout(-10);
  });

  it('should use wall time if no options are specified', function(done) {
    var startTime = new Date();
    var timer = new TimeoutTimer(50);
    timer.on('timeout', function() {
      expect(new Date() - startTime, 'timer should wait for the correct amount of time').to.be.within(30, 70);
      done();
    });
  });

  it('should support cancellation when no options are specified', function() {
    var timer = new TimeoutTimer(50);
    var timerPromise = new Promise(function(resolve, reject) {
      timer.on('timeout', function() {
        reject(new Error('Should have been cancelled by now'));
      });
    });

    timer.cancel();

    return Promise.race([
      timerPromise,
      delay(200)  // Wait for a little while to really see that the timer was cancelled
    ]);
  });
});
