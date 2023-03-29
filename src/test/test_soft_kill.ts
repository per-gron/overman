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

import { expect } from 'chai';
import softKill from '../soft_kill';
import { FakeTimer } from '../timeout_timer';
import { FakeProcess } from '../fakes/fake_process_like';
import { Message } from '../reporters/message';

describe('Soft kill', function () {
  it("should immediately send a 'sigint' message to the process", function () {
    let sigintWasSent = false;
    softKill(
      new FakeProcess<Message>(
        () => {},
        (message) => {
          if (message.type === 'sigint') {
            sigintWasSent = true;
          }
        }
      ),
      1
    );

    expect(sigintWasSent, "'sigint' message should be sent immediately").to.be.true;
  });

  it('should set up a timer with the specified timeout', function (done) {
    softKill(new FakeProcess(), 123, (timeout) => {
      expect(timeout).to.be.equal(123);
      done();
      return new FakeTimer();
    });
  });

  it('should cancel the timer when the process exits', function (done) {
    const process = new FakeProcess();
    softKill(process, 1, () => new FakeTimer(done));

    process.emit('exit');
  });

  it('should send a SIGKILL when the timer fires', function (done) {
    const proc = new FakeProcess((signal) => {
      if (signal === 'SIGKILL') {
        done();
      }
    });

    const timer = new FakeTimer();
    softKill(proc, 1, () => (process.nextTick(() => timer.emit('timeout')), timer));

    proc.emit('exit');
  });

  it('should immediately send SIGKILL if timeout is 0', function () {
    let wasKilled = false;
    const proc = new FakeProcess((signal) => {
      expect(signal).to.be.equal('SIGKILL');
      wasKilled = true;
    });

    softKill(proc, 0, () => new FakeTimer());

    expect(wasKilled, 'process should be immediately killed').to.be.true;
  });
});
