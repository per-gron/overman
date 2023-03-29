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

var through = require('through');
var chalk = require('chalk');
var Summary = require('../reporters/summary');
var makeFakeClock = require('./util/fake_clock').default;
var streamUtil = require('./util/stream');

function performActionsAndCheckOutput(actions, output, options) {
  var stripped = (options || {}).dontStrip ? through() : streamUtil.stripAnsiStream();
  var summary = new Summary(stripped);

  var promise = streamUtil.waitForStreamToEmitLines(stripped, output);

  actions(summary);

  stripped.end();

  return promise;
}

describe('Summary reporter', function () {
  var clock;

  beforeEach(function () {
    clock = makeFakeClock();
  });

  before(function () {
    chalk.enabled = true;
  });

  it('should always report passing tests, even when no tests pass', function () {
    return performActionsAndCheckOutput(
      function (summary) {
        summary.registerTests([], {}, clock.clock());
        summary.done(clock.clock());
      },
      ['', /0 passing/, '']
    );
  });

  it('should report number of passed tests', function () {
    return performActionsAndCheckOutput(
      function (summary) {
        summary.registerTests([], {}, clock.clock());
        summary.gotMessage(null, { type: 'finish', result: 'success' });
        summary.done(clock.clock());
      },
      ['', /1 passing/, '']
    );
  });

  it('should report total time it took for tests to run', function () {
    return performActionsAndCheckOutput(
      function (summary) {
        summary.registerTests([], {}, clock.clock());
        clock.step(4000);
        summary.done(clock.clock());
      },
      ['', /(4s)/, '']
    );
  });

  it('should report number of skipped tests', function () {
    return performActionsAndCheckOutput(
      function (summary) {
        summary.registerTests([], {}, clock.clock());
        summary.gotMessage(null, { type: 'finish', result: 'skipped' });
        summary.done(clock.clock());
      },
      ['', /0 passing/, /1 skipped/, '']
    );
  });

  it('should report number of aborted tests', function () {
    return performActionsAndCheckOutput(
      function (summary) {
        summary.registerTests([], {}, clock.clock());
        summary.gotMessage(null, { type: 'finish', result: 'aborted' });
        summary.done(clock.clock());
      },
      ['', /0 passing/, /1 aborted/, '']
    );
  });

  it('should report number of failing tests', function () {
    return performActionsAndCheckOutput(
      function (summary) {
        summary.registerTests([], {}, clock.clock());
        summary.gotMessage(null, { type: 'finish', result: 'failure' });
        summary.done(clock.clock());
      },
      ['', /0 passing/, /1 failing/, '']
    );
  });

  it('should report number of tests that time out', function () {
    return performActionsAndCheckOutput(
      function (summary) {
        summary.registerTests([], {}, clock.clock());
        summary.gotMessage(null, { type: 'finish', result: 'timeout' });
        summary.done(clock.clock());
      },
      ['', /0 passing/, /1 failing/, '']
    );
  });

  it('should report number of skipped, timed out and number of failing tests', function () {
    return performActionsAndCheckOutput(
      function (summary) {
        summary.registerTests([], {}, clock.clock());
        summary.gotMessage(null, { type: 'finish', result: 'failure' });
        summary.gotMessage(null, { type: 'finish', result: 'skipped' });
        summary.gotMessage(null, { type: 'finish', result: 'timeout' });
        summary.done(clock.clock());
      },
      ['', /0 passing/, /1 skipped/, /2 failing/, '']
    );
  });

  it('should report number of skipped, aborted, timed out and number of failing tests', function () {
    return performActionsAndCheckOutput(
      function (summary) {
        summary.registerTests([], {}, clock.clock());
        summary.gotMessage(null, { type: 'finish', result: 'failure' });
        summary.gotMessage(null, { type: 'finish', result: 'skipped' });
        summary.gotMessage(null, { type: 'finish', result: 'aborted' });
        summary.gotMessage(null, { type: 'finish', result: 'timeout' });
        summary.done(clock.clock());
      },
      ['', /0 passing/, /1 skipped/, /2 failing/, /1 aborted/, '']
    );
  });

  it('should color the passing tests text', function () {
    return performActionsAndCheckOutput(
      function (summary) {
        summary.registerTests([], {}, clock.clock());
        summary.done(clock.clock());
      },
      ['', new RegExp('\u001b\\[32m0 passing\u001b\\[39m'), ''],
      { dontStrip: true }
    );
  });

  it('should color the test time text', function () {
    return performActionsAndCheckOutput(
      function (summary) {
        summary.registerTests([], {}, clock.clock());
        summary.done(clock.clock());
      },
      ['', new RegExp('\u001b\\[90m\\(0s\\)\u001b\\[39m'), ''],
      { dontStrip: true }
    );
  });

  it('should color the skipped tests text', function () {
    return performActionsAndCheckOutput(
      function (summary) {
        summary.registerTests([], {}, clock.clock());
        summary.gotMessage(null, { type: 'finish', result: 'skipped' });
        summary.done(clock.clock());
      },
      ['', /passing/, new RegExp('\u001b\\[36m1 skipped\u001b\\[39m'), ''],
      { dontStrip: true }
    );
  });

  it('should color the aborted tests text', function () {
    return performActionsAndCheckOutput(
      function (summary) {
        summary.registerTests([], {}, clock.clock());
        summary.gotMessage(null, { type: 'finish', result: 'aborted' });
        summary.done(clock.clock());
      },
      ['', /passing/, new RegExp('\u001b\\[33m1 aborted\u001b\\[39m'), ''],
      { dontStrip: true }
    );
  });

  it('should color the failing tests text', function () {
    return performActionsAndCheckOutput(
      function (summary) {
        summary.registerTests([], {}, clock.clock());
        summary.gotMessage(null, { type: 'finish', result: 'failure' });
        summary.done(clock.clock());
      },
      ['', /passing/, new RegExp('\u001b\\[31m1 failing\u001b\\[39m'), ''],
      { dontStrip: true }
    );
  });
});
