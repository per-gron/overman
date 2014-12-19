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
var PhaseTracker = require('../lib/reporters/phase_tracker');

describe('PhaseTracker', function() {
  var tracker;
  beforeEach(function() {
    tracker = new PhaseTracker();
  });

  it('should return undefined for tests that haven\'t done anything yet', function() {
    expect(tracker.getLastPhase({})).to.be.undefined;
  });

  it('should report the before hook phase', function() {
    tracker.gotMessage({ test: 'path' }, { type: 'startedBeforeHook', name: 'The hook' });
    expect(tracker.getLastPhase({ test: 'path' })).to.be.deep.equal({ in: 'beforeHook', inName: 'The hook' });
  });

  it('should report the test phase', function() {
    tracker.gotMessage({ test: 'path' }, { type: 'startedTest' });
    expect(tracker.getLastPhase({ test: 'path' })).to.be.deep.equal({ in: 'test' });
  });

  it('should report the after hook phase', function() {
    tracker.gotMessage({ test: 'path' }, { type: 'startedAfterHook', name: 'The hook' });
    expect(tracker.getLastPhase({ test: 'path' })).to.be.deep.equal({ in: 'afterHook', inName: 'The hook' });
  });

  it('should report the last phase when several are received for one test', function() {
    tracker.gotMessage({ test: 'path' }, { type: 'startedBeforeHook', name: 'The hook 1' });
    tracker.gotMessage({ test: 'path' }, { type: 'startedAfterHook', name: 'The hook 2' });
    expect(tracker.getLastPhase({ test: 'path' })).to.be.deep.equal({ in: 'afterHook', inName: 'The hook 2' });
  });

  it('should separate phases of different tests', function() {
    tracker.gotMessage({ test: 'path1' }, { type: 'startedBeforeHook', name: 'The hook 1' });
    tracker.gotMessage({ test: 'path2' }, { type: 'startedAfterHook', name: 'The hook 2' });
    expect(tracker.getLastPhase({ test: 'path1' })).to.be.deep.equal({ in: 'beforeHook', inName: 'The hook 1' });
  });

  it('should reset the phase on retry', function() {
    tracker.gotMessage({ test: 'path' }, { type: 'startedBeforeHook', name: 'The hook 1' });
    tracker.gotMessage({ test: 'path' }, { type: 'retry' });
    expect(tracker.getLastPhase({ test: 'path' })).to.not.exist;
  });
});
