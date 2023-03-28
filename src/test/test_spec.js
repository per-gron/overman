/*
 * Copyright 2014-2016 Per Eckerdal
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
var Spec = require('../reporters/spec');
var suiteRunner = require('../suite_runner');
var OnMessage = require('./util/on_message');
var streamUtil = require('./util/stream');

function simulateOneTest(spec) {
  var path = { file: 'file', path: ['suite_name', 'test'] };

  spec.registerTests([path], { slowThreshold: 100 }, new Date());
  spec.gotMessage(path, { type: 'start' });
  spec.gotMessage(path, {
    type: 'finish',
    result: 'success',
    slow: true,
    duration: 123,
  });
  spec.done(new Date());
}

function simulateAndWaitForLine(simulate, line) {
  var out = streamUtil.stripAnsiStream();

  var outputPromise = streamUtil.waitForStreamToEmitLine(out, line);

  var spec = new Spec({ stdout: out });
  simulate(spec);

  out.end();

  return outputPromise;
}

function simulateOneTestAndWaitForLine(line) {
  return simulateAndWaitForLine(simulateOneTest, line);
}

describe('Spec reporter', function () {
  it('should mark slow tests', function () {
    return simulateOneTestAndWaitForLine(/\(123ms\)/);
  });

  it('should mark suites', function () {
    return simulateOneTestAndWaitForLine(/suite_name/);
  });

  it('should emit a summary', function () {
    return simulateOneTestAndWaitForLine(/1 passing/);
  });

  it('should print details about errors', function () {
    return simulateAndWaitForLine(function simulateFailingTest(spec) {
      var path = { file: 'file', path: ['suite_name', 'test'] };

      spec.registerTests([path], { slowThreshold: 100 }, new Date());
      spec.gotMessage(path, { type: 'start' });
      spec.gotMessage(path, {
        type: 'error',
        in: 'uncaught',
        stack: 'an_error',
      });
      spec.gotMessage(path, {
        type: 'finish',
        result: 'failure',
      });
      spec.done(new Date());
    }, /Uncaught error: an_error/);
  });

  it('should print to stdout by default', function () {
    var out = through();
    var outputPromise = streamUtil.waitForStreamToEmitLines(out, [/./, /suite_name/, /test/]);

    // This test can't be done within the test process, because when the test
    // runs in Mocha it's not ok to pipe stdout to something else.
    var suitePromise = suiteRunner({
      files: [__dirname + '/../../data/suite/' + 'suite_spec_should_print_to_stdout_by_default'],
      timeout: 1000,
      reporters: new OnMessage(function (path, message) {
        if (message.type === 'finish') {
          out.end();
        } else if (message.type === 'stdout') {
          out.write(message.data);
        }
      }),
      internalErrorOutput: through(),
    });

    return Promise.all([suitePromise, outputPromise]);
  });
});
