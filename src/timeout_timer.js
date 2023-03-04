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

var EventEmitter = require('events').EventEmitter;

/**
 * TimeoutTimer is a class that sets a timer similarly to setTimeout. The
 * difference is that TimeoutTimer also supports changing the timeout while
 * it's running. This is used for test timeouts; the tests can change their
 * own timeout while they are run. (Yes, this is a bit crazy, but I want to
 * be mocha compatible.)
 *
 * TimeoutTimer is an EventEmitter and will emit a 'timeout' message when the
 * time is up.
 *
 * @param timeout The timeout in milliseconds
 * @param options For testing purposes and other customization, it's possible
 *     to inject non-standard means of measuring time and setting timeouts.
 *     {
 *       clock: [function that returns the current time as a Date object],
 *       setTimeout: [set a timeout. Same signature as Javascript's setTimeout.
 *         Rhis function should always invoke its callback asynchronously],
 *       clearTimeout: [cancel a timeout. Same signature as Javascript's clearTimeout]
 *     }
 *     Optional.
 */
function TimeoutTimer(timeout, options) {
  if (typeof timeout !== 'number') {
    throw new Error('Invalid or missing timeout parameter');
  }

  this._timeout = timeout;
  this._clock =
    (options || {}).clock ||
    function () {
      return new Date();
    };
  this._startTime = this._clock().getTime();
  this._setTimeout = (options || {}).setTimeout || setTimeout;
  this._clearTimeout = (options || {}).clearTimeout || clearTimeout;
  this._timeoutToken = null;

  this._armTimeout();
}
TimeoutTimer.prototype = Object.create(EventEmitter.prototype);

TimeoutTimer.prototype._timedOut = function () {
  this._timeoutToken = null;
  this.emit('timeout', this._timeout);
};

/**
 * Calculate the remaining time for this timeout. May return a negative number.
 */
TimeoutTimer.prototype._remainingTime = function () {
  return this._timeout - (this._clock().getTime() - this._startTime);
};

TimeoutTimer.prototype._armTimeout = function () {
  if (this._timeoutToken) {
    this._clearTimeout(this._timeoutToken);
  }

  var remainingTime = this._remainingTime();
  if (remainingTime > 0) {
    this._timeoutToken = this._setTimeout(this._timedOut.bind(this), remainingTime);
  } else {
    var self = this;
    process.nextTick(function () {
      self._timedOut();
    });
  }
};

/**
 * Change the timeout of this object. The timeout is relative from when the
 * timer was created. Setting the timeout to a time that has already passed
 * causes the timer to elapse immediately (on the next tick).
 */
TimeoutTimer.prototype.updateTimeout = function (timeout) {
  if (this._timeoutToken === null) {
    throw new Error('Cannot updateTimeout on timer that has elapsed');
  }

  this._timeout = timeout;
  this._armTimeout();
};

/**
 * Cancel the timer.
 */
TimeoutTimer.prototype.cancel = function () {
  this._clearTimeout(this._timeoutToken);
  this._timeoutToken = null;
};

module.exports = TimeoutTimer;
