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
import TimeoutTimer from '../timeout_timer';
import makeFakeClock from './util/fake_clock';
import { setTimeout } from 'timers/promises';

describe('TimeoutTimer', function () {
  it('should support being created without options parameter', function () {
    new TimeoutTimer(100, { setTimeout: () => 0 });
  });

  it('should emit "timeout" event when time is up', function (done) {
    let callback: (() => void) | undefined;
    const timer = new TimeoutTimer(100, {
      setTimeout: (cb) => {
        callback = cb;
        return 0;
      },
    });
    expect(callback).to.be.a('function');

    timer.on('timeout', () => done());

    callback!();
  });

  it('should not immediately clear the not-yet-armed timeout', function () {
    new TimeoutTimer(100, {
      setTimeout: () => 0,
      clearTimeout: () => {
        throw new Error('Should not be called');
      },
    });
  });

  it('should clear the timeout on cancel', function (done) {
    const timer = new TimeoutTimer(100, {
      setTimeout: () => 42,
      clearTimeout: (token) => {
        expect(token).to.be.equal(42);
        done();
      },
    });

    timer.cancel();
  });

  it('should set a timeout with the proper time', function (done) {
    new TimeoutTimer(100, {
      clock: () => 12345,
      setTimeout: (_, time) => {
        expect(time).to.be.equal(100);
        done();
        return 0;
      },
    });
  });

  it('should update the timeout on updateTimeout', function (done) {
    const { clock, step } = makeFakeClock();

    let call = 0;
    const timer = new TimeoutTimer(123, {
      clock: () => clock().getTime(),
      setTimeout: (callback, time) => (
        [
          () =>
            process.nextTick(() => {
              step(111);
              timer.updateTimeout(456);
              callback();
            }),
          () => {
            expect(time).to.be.equal(345);
            done();
          },
        ][call++](),
        0
      ),
    });
  });

  it('should refuse to updateTimeout on an elapsed timer', function () {
    const timer = new TimeoutTimer(80, {
      clock: () => 321,
      setTimeout: (callback) => {
        process.nextTick(() => {
          callback();
          expect(() => timer.updateTimeout(654)).to.throw('timer that has elapsed');
        });
        return 0;
      },
    });
  });

  it('should refuse to updateTimeout on a cancelled timer', function () {
    const timer = new TimeoutTimer(80, { setTimeout: () => 0 });

    timer.cancel();
    expect(() => timer.updateTimeout(654)).to.throw('timer that has elapsed');
  });

  it("should invoke the callback on the next tick when timeout is updated to a time that's already passed", function (done) {
    let onInitialTick = true;
    let onTickAfterTimerCreation = false;

    process.nextTick(() => (onInitialTick = false));

    const timer = new TimeoutTimer(10);
    timer.on('timeout', () => {
      expect(onInitialTick, 'should not be on the initial tick').to.be.false;
      expect(onTickAfterTimerCreation, 'should not have waited longer than one tick').to.be.false;
      done();
    });
    timer.updateTimeout(-10);

    process.nextTick(() => (onTickAfterTimerCreation = true));
  });

  it('should invoke callback on a separate tick even when the timer is updated to a time in the past', function (done) {
    let onInitialTick = true;
    process.nextTick(() => (onInitialTick = false));

    const timer = new TimeoutTimer(10);
    timer.on('timeout', () => {
      expect(onInitialTick, 'should not be on the initial tick').to.be.false;
      done();
    });
    timer.updateTimeout(-10);
  });

  it('should use wall time if no options are specified', function (done) {
    const startTime = Date.now();
    const timer = new TimeoutTimer(50);
    timer.on('timeout', () => {
      expect(
        Date.now() - startTime,
        'timer should wait for the correct amount of time'
      ).to.be.within(30, 70);
      done();
    });
  });

  it('should support cancellation when no options are specified', function () {
    const timer = new TimeoutTimer(50);
    const timerPromise = new Promise((_, reject) =>
      timer.on('timeout', () => {
        reject(new Error('Should have been cancelled by now'));
      })
    );

    timer.cancel();

    // Wait for a little while to really see that the timer was cancelled
    return Promise.race([timerPromise, setTimeout(200)]);
  });
});
