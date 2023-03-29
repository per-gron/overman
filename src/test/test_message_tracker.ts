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
import { ErrorMessage } from '../reporters/message';
import MessageTracker from '../reporters/message_tracker';

describe('MessageTracker', function () {
  const tracker = new MessageTracker<ErrorMessage>('error');

  it("should return empty array of failues for tests that haven't failed", function () {
    expect(tracker.getMessages({ file: 'path', path: [] })).to.be.deep.equal([]);
  });

  it('should return message for a test', function () {
    const path = { file: 'path', path: [] };
    const errorMessage: ErrorMessage = { type: 'error', stack: 'Hey!', in: 'test' };

    tracker.gotMessage(path, errorMessage);
    expect(tracker.getMessages(path)).to.be.deep.equal([errorMessage]);
  });

  it('should return multiple messages for a test', function () {
    const path = { file: 'path', path: [] };
    const errorMessage1: ErrorMessage = { type: 'error', stack: 'Hey! 1', in: 'test' };
    const errorMessage2: ErrorMessage = { type: 'error', stack: 'Hey! 2', in: 'test' };

    tracker.gotMessage(path, errorMessage1);
    tracker.gotMessage(path, errorMessage2);
    expect(tracker.getMessages(path)).to.be.deep.equal([errorMessage1, errorMessage2]);
  });

  it('should return separate messages for separate tests', function () {
    const path1 = { file: 'path1', path: [] };
    const path2 = { file: 'path2', path: [] };
    const errorMessage1: ErrorMessage = { type: 'error', stack: 'Hey! 1', in: 'test' };
    const errorMessage2: ErrorMessage = { type: 'error', stack: 'Hey! 2', in: 'test' };

    tracker.gotMessage(path1, errorMessage1);
    tracker.gotMessage(path2, errorMessage2);
    expect(tracker.getMessages(path1)).to.be.deep.equal([errorMessage1]);
  });

  it('should reset the messages on retry', function () {
    const path = { file: 'path', path: [] };
    const errorMessage: ErrorMessage = { type: 'error', stack: 'Hey!', in: 'test' };

    tracker.gotMessage(path, errorMessage);
    tracker.gotMessage(path, { type: 'retry', result: 'failure', unstable: false });
    expect(tracker.getMessages(path)).to.be.empty;
  });

  it('should cease to collect messages on timeout', function () {
    const path = { file: 'path', path: [] };
    const errorMessage: ErrorMessage = { type: 'error', stack: 'Hey!', in: 'test' };

    tracker.gotMessage(path, errorMessage);
    tracker.gotMessage(path, { type: 'timeout' });
    tracker.gotMessage(path, errorMessage);
    expect(tracker.getMessages(path)).to.be.deep.equal([errorMessage]);
  });

  it('should collect messages after timeout + retry', function () {
    const path = { file: 'path', path: [] };
    const errorMessage1: ErrorMessage = { type: 'error', stack: 'Hey 1!', in: 'test' };
    const errorMessage2: ErrorMessage = { type: 'error', stack: 'Hey 2!', in: 'test' };

    tracker.gotMessage(path, errorMessage1);
    tracker.gotMessage(path, { type: 'timeout' });
    tracker.gotMessage(path, { type: 'retry', result: 'timeout', unstable: false });
    tracker.gotMessage(path, errorMessage2);
    expect(tracker.getMessages(path)).to.be.deep.equal([errorMessage2]);
  });
});
