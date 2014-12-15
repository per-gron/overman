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

/**
 * Stopwatch is a simple little helper class that you start at a given time and
 * feed with named events. Then you can ask it for how long it was since it was
 * started, and how long it has been since the last event of a given name.
 *
 * @param clock. Function that returns wall time as a Date object. Optional.
 */
function Stopwatch(clock) {
  this._clock = clock || function() { return new Date(); };
  this._startedAt = this._clock();
  this._events = {};
}

Stopwatch.prototype.emit = function(name) {
  this._events[name] = this._clock().getTime();
};

Stopwatch.prototype._getTimeSince = function(time) {
  return this._clock().getTime() - time;
};

Stopwatch.prototype.getTimeSinceStart = function() {
  return this._getTimeSince(this._startedAt);
};

Stopwatch.prototype.getTimeSince = function(name) {
  if (!(name in this._events)) {
    throw new Error('No registered timestamp for event with name ' + name);
  }
  return this._getTimeSince(this._events[name]);
};

module.exports = Stopwatch;
