'use strict';

/**
 * Timer is a simple little helper class that you start at a given time and feed
 * with named events. Then you can ask it for how long it was since it was
 * started, and how long it has been since the last event of a given name.
 *
 * @param getTime. Function that returns wall time in milliseconds, since an
 *     arbitrary point in time. Optional.
 */
function Timer(getTime) {
  this._getTime = getTime || function() { return (new Date).getTime(); };
  this._startedAt = this._getTime();
  this._events = {};
}

Timer.prototype.emit = function(name) {
  this._events[name] = this._getTime();
};

Timer.prototype._getTimeSince = function(time) {
  return this._getTime() - time;
};

Timer.prototype.getTimeSinceStart = function() {
  return this._getTimeSince(this._startedAt);
};

Timer.prototype.getTimeSince = function(name) {
  if (!(name in this._events)) {
    throw new Error('No registered timestamp for event with name ' + name);
  }
  return this._getTimeSince(this._events[name]);
};

module.exports = Timer;
