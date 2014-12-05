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
var softKill = require('../lib/soft_kill');
var EventEmitter = require('events').EventEmitter;

function fakeProcess(kill) {
  var process = new EventEmitter();
  process.kill = kill || function() {};
  return process;
}

describe('Soft kill', function() {
  it('should immediately send a SIGINT to the process', function() {
    var sigintWasSent = false;

    softKill(fakeProcess(function kill(signal) {
      sigintWasSent = sigintWasSent || signal === 'SIGINT';
    }), 1);

    expect(sigintWasSent, 'SIGINT should be sent immediately').to.be.true;
  });

  it('should set up a timer with the specified timeout', function(done) {
    function TimeoutTimer(timeout) {
      expect(timeout).to.be.equal(123);
      done();
    }
    TimeoutTimer.prototype = Object.create(EventEmitter.prototype);
    softKill(fakeProcess(), 123, TimeoutTimer);
  });

  it('should cancel the timer when the process exits', function(done) {
    var process = fakeProcess();

    function TimeoutTimer() {
      this.cancel = done;
    }
    TimeoutTimer.prototype = Object.create(EventEmitter.prototype);
    softKill(process, 1, TimeoutTimer);

    process.emit('exit');
  });

  it('should send a SIGKILL when the timer fires', function(done) {
    var proc = fakeProcess(function kill(signal) {
      if (signal === 'SIGKILL') {
        done();
      }
    });

    function TimeoutTimer() {
      var self = this;
      process.nextTick(function() {
        self.emit('timeout');
      });
      this.cancel = function() {};
    }
    TimeoutTimer.prototype = Object.create(EventEmitter.prototype);

    softKill(proc, 1, TimeoutTimer);

    proc.emit('exit');
  });

  it('should immediately send SIGKILL if timeout is 0', function() {
    var wasKilled = false;
    var proc = fakeProcess(function kill(signal) {
      expect(signal).to.be.equal('SIGKILL');
      wasKilled = true;
    });

    softKill(proc, 0, {});

    expect(wasKilled, 'process should be immediately killed').to.be.true;
  });
});
