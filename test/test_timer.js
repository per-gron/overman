'use strict';

var expect = require('chai').expect;
var when = require('when');
var Timer = require('../lib/timer');

function makeFakeClock() {
  var time = Math.floor(Math.random() * 1000);
  var timer = function() {
    return time;
  }
  timer.step = function(steps) { time += steps; }
  return timer;
}

describe('Timer', function() {
  var clock;
  var timer;
  beforeEach(function() {
    clock = makeFakeClock();
    timer = new Timer(clock);
  });

  it('should report time since start', function() {
    clock.step(100);
    expect(timer.getTimeSinceStart()).to.be.equal(100);
  });

  it('should throw exception when asked for time since event that has not happened', function() {
    expect(function() {
      timer.getTimeSince('nonexistentEvent');
    }).to.throw(/No registered timestamp for event/);
  });

  it('should report time since event', function() {
    timer.emit('eventName');
    clock.step(200);
    expect(timer.getTimeSince('eventName')).to.be.equal(200);
  });

  it('should report time since last event', function() {
    timer.emit('eventName');
    clock.step(200);
    timer.emit('eventName');
    clock.step(200);
    expect(timer.getTimeSince('eventName')).to.be.equal(200);
  });

  it('should report time since last event with same name', function() {
    timer.emit('eventName1');
    clock.step(200);
    timer.emit('eventName2');
    clock.step(200);
    expect(timer.getTimeSince('eventName1')).to.be.equal(400);
  });

  it('should use wall time as default clock', function() {
    var timer = new Timer();
    return when()
      .delay(300)
      .then(function() {
        expect(timer.getTimeSinceStart()).to.be.within(300, 400);
      });
  });
});
