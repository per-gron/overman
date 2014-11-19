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
        expect(stopwatch.getTimeSinceStart()).to.be.within(300, 400);
      });
  });
});
