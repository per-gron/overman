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
import PhaseTracker from '../reporters/phase_tracker';

describe('PhaseTracker', function () {
  let tracker: PhaseTracker;

  beforeEach(function () {
    tracker = new PhaseTracker();
  });

  it("should return undefined for tests that haven't done anything yet", function () {
    expect(tracker.getLastPhase({ file: 'test', path: [] })).to.be.undefined;
  });

  it('should report the before hook phase', function () {
    tracker.gotMessage({ file: 'test', path: [] }, { type: 'startedBeforeHook', name: 'The hook' });
    expect(tracker.getLastPhase({ file: 'test', path: [] })).to.be.deep.equal({
      in: 'beforeHook',
      inName: 'The hook',
    });
  });

  it('should report the test phase', function () {
    tracker.gotMessage({ file: 'test', path: [] }, { type: 'startedTest' });
    expect(tracker.getLastPhase({ file: 'test', path: [] })).to.be.deep.equal({ in: 'test' });
  });

  it('should report the after hook phase', function () {
    tracker.gotMessage({ file: 'test', path: [] }, { type: 'startedAfterHook', name: 'The hook' });
    expect(tracker.getLastPhase({ file: 'test', path: [] })).to.be.deep.equal({
      in: 'afterHook',
      inName: 'The hook',
    });
  });

  it('should report the last phase when several are received for one test', function () {
    tracker.gotMessage(
      { file: 'test', path: [] },
      { type: 'startedBeforeHook', name: 'The hook 1' }
    );
    tracker.gotMessage(
      { file: 'test', path: [] },
      { type: 'startedAfterHook', name: 'The hook 2' }
    );
    expect(tracker.getLastPhase({ file: 'test', path: [] })).to.be.deep.equal({
      in: 'afterHook',
      inName: 'The hook 2',
    });
  });

  it('should separate phases of different tests', function () {
    tracker.gotMessage(
      { file: 'test1', path: [] },
      { type: 'startedBeforeHook', name: 'The hook 1' }
    );
    tracker.gotMessage(
      { file: 'test2', path: [] },
      { type: 'startedAfterHook', name: 'The hook 2' }
    );
    expect(tracker.getLastPhase({ file: 'test1', path: [] })).to.be.deep.equal({
      in: 'beforeHook',
      inName: 'The hook 1',
    });
  });

  it('should reset the phase on retry', function () {
    tracker.gotMessage(
      { file: 'test', path: [] },
      { type: 'startedBeforeHook', name: 'The hook 1' }
    );
    tracker.gotMessage(
      { file: 'test', path: [] },
      { type: 'retry', result: 'failure', unstable: false }
    );
    expect(tracker.getLastPhase({ file: 'test', path: [] })).to.not.exist;
  });

  it('should ignore phases after timeout', function () {
    tracker.gotMessage(
      { file: 'test', path: [] },
      { type: 'startedBeforeHook', name: 'The hook 1' }
    );
    tracker.gotMessage({ file: 'test', path: [] }, { type: 'timeout' });
    tracker.gotMessage(
      { file: 'test', path: [] },
      { type: 'startedAfterHook', name: 'The hook 2' }
    );
    expect(tracker.getLastPhase({ file: 'test', path: [] })).to.be.deep.equal({
      in: 'beforeHook',
      inName: 'The hook 1',
    });
  });

  it('should start saving phases again after retries even if the previous attempt timed out', function () {
    tracker.gotMessage(
      { file: 'test', path: [] },
      { type: 'startedBeforeHook', name: 'The hook 1' }
    );
    tracker.gotMessage({ file: 'test', path: [] }, { type: 'timeout' });
    tracker.gotMessage(
      { file: 'test', path: [] },
      { type: 'retry', result: 'timeout', unstable: false }
    );
    tracker.gotMessage(
      { file: 'test', path: [] },
      { type: 'startedAfterHook', name: 'The hook 2' }
    );
    expect(tracker.getLastPhase({ file: 'test', path: [] })).to.be.deep.equal({
      in: 'afterHook',
      inName: 'The hook 2',
    });
  });
});
