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
var expect = require('chai').expect;
var makeFakeClock = require('./util/fake_clock');
var OnMessage = require('./util/on_message');
var Timer = require('../lib/reporter/timer');

describe('Timer reporter', function() {
  var clock;
  var messages;
  var timer;
  var slowThreshold;
  beforeEach(function() {
    clock = makeFakeClock();
    messages = new EventEmitter();
    slowThreshold = 1000;
    timer = new Timer(new OnMessage(messages.emit.bind(messages, 'message')), slowThreshold, clock);
  });

  it('should require the default slow threshold parameter', function() {
    expect(function() {
      new Timer({});
    }).to.throw(/slow threshold/);
  });

  describe('Forwarding', function() {
    ['registrationFailed', 'registerTests', 'done', 'gotMessage'].forEach(function(message) {
      it('should forward ' + message + ' calls', function(done) {
        var reporter = {};
        reporter[message] = function(arg1, arg2) {
          expect(arg1).to.be.equal('arg1');
          expect(arg2).to.be.equal('arg2');
          done();
        };

        var timer = new Timer(reporter, 0);
        timer[message]('arg1', 'arg2');
      });
    });
  });

  describe('Time', function() {
    it('should add time to finish messages', function(done) {
      messages.on('message', function(path, message) {
        if (message.type === 'finish') {
          expect(message).property('duration').to.be.equal(100);
          done();
        }
      });

      timer.gotMessage('test', { type: 'start' });
      clock.step(10);
      timer.gotMessage('test', { type: 'startedTest' });
      clock.step(100);
      timer.gotMessage('test', { type: 'startedAfterHooks' });
      clock.step(1000);
      timer.gotMessage('test', { type: 'finish' });
    });

    it('should use wall clock by default', function(done) {
      var timer = new Timer(new OnMessage(messages.emit.bind(messages, 'message')), 0);
      messages.on('message', function(path, message) {
        if (message.type === 'finish') {
          expect(message).property('duration').to.be.within(90, 150);
          done();
        }
      });

      timer.gotMessage('test', { type: 'start' });
      timer.gotMessage('test', { type: 'startedTest' });
      setTimeout(function() {
        timer.gotMessage('test', { type: 'startedAfterHooks' });
        timer.gotMessage('test', { type: 'finish' });
      }, 100);
    });

    it('should not crash when receiving mismatched finish message', function(done) {
      messages.on('message', function(path, message) {
        if (message.type === 'finish') {
          done();
        }
      });

      timer.gotMessage('test', { type: 'finish' });
    });
  });

  describe('slow and halfSlow', function() {
    [true, false].forEach(function(shouldEmitSetSlowThresholdMessage) {
      it('should not mark fast test as slow or halfSlow' + (shouldEmitSetSlowThresholdMessage ? ' when slow threshold is modified' : ''), function(done) {
        messages.on('message', function(path, message) {
          if (message.type === 'finish') {
            expect(message).property('slow').to.be.false;
            expect(message).property('halfSlow').to.be.false;
            done();
          }
        });

        timer.gotMessage('test', { type: 'start' });
        if (shouldEmitSetSlowThresholdMessage) {
          timer.gotMessage('test', { type: 'setSlowThreshold', value: 2000 });
        }
        timer.gotMessage('test', { type: 'startedTest' });
        clock.step(shouldEmitSetSlowThresholdMessage ? 999 : 499);
        timer.gotMessage('test', { type: 'startedAfterHooks' });
        timer.gotMessage('test', { type: 'finish' });
      });

      it('should not mark half-slow test as halfSlow' + (shouldEmitSetSlowThresholdMessage ? ' when slow threshold is modified' : ''), function(done) {
        messages.on('message', function(path, message) {
          if (message.type === 'finish') {
            expect(message).property('slow').to.be.false;
            expect(message).property('halfSlow').to.be.true;
            done();
          }
        });

        timer.gotMessage('test', { type: 'start' });
        timer.gotMessage('test', { type: 'startedTest' });
        if (shouldEmitSetSlowThresholdMessage) {
          timer.gotMessage('test', { type: 'setSlowThreshold', value: 500 });
        }
        clock.step(shouldEmitSetSlowThresholdMessage ? 250 : 500);
        timer.gotMessage('test', { type: 'startedAfterHooks' });
        timer.gotMessage('test', { type: 'finish' });
      });

      it('should not mark slow test as slow and halfSlow' + (shouldEmitSetSlowThresholdMessage ? ' when slow threshold is modified' : ''), function(done) {
        messages.on('message', function(path, message) {
          if (message.type === 'finish') {
            expect(message).property('slow').to.be.true;
            expect(message).property('halfSlow').to.be.true;
            done();
          }
        });

        timer.gotMessage('test', { type: 'start' });
        if (shouldEmitSetSlowThresholdMessage) {
          timer.gotMessage('test', { type: 'setSlowThreshold', value: 2000 });
        }
        timer.gotMessage('test', { type: 'startedTest' });
        clock.step(shouldEmitSetSlowThresholdMessage ? 2000 : 1000);
        timer.gotMessage('test', { type: 'startedAfterHooks' });
        timer.gotMessage('test', { type: 'finish' });
      });
    });
  });
});
