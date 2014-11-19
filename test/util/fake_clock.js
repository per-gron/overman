'use strict';

function makeFakeClock() {
  var time = Math.floor(Math.random() * 1000);
  var clock = function() {
    return time;
  }
  clock.step = function(steps) { time += steps; }
  return clock;
}
module.exports = makeFakeClock;
