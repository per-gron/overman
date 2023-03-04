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
var Teamcity = require('../dist/reporters/teamcity');
var streamUtil = require('./util/stream');

function performActionsAndCheckOutput(actions, output) {
  var stream = through();
  var reporter = new Teamcity(stream);

  var promise = streamUtil.waitForStreamToEmitLines(stream, output);

  actions(reporter);

  stream.end();

  return promise;
}

describe('TeamCity reporter', function () {
  describe('registrationFailed', function () {
    it('should emit error when test registration fails', function () {
      return performActionsAndCheckOutput(
        function (reporter) {
          var error = new Error('Hey!');
          error.stack = 'Hey!\nA\nB';
          reporter.registrationFailed(error);
        },
        [
          /##teamcity\[testStarted name='Processing of test files' flowId='\d+' timestamp='....-..-..T..:..:..\....'\]/,
          /##teamcity\[testFailed message='Error when loading the test files' details='Hey!\|nA\|nB' flowId='\d+' timestamp='....-..-..T..:..:..\....'\]/,
          /##teamcity\[testFinished name='Processing of test files' flowId='\d+' timestamp='....-..-..T..:..:..\....'\]/,
        ]
      );
    });
  });

  describe('stdio messages', function () {
    it('should forward stdout', function () {
      return performActionsAndCheckOutput(
        function (reporter) {
          var path = { file: 'file', path: ['test'] };
          reporter.gotMessage(path, { type: 'start' });
          reporter.gotMessage(path, {
            type: 'stdout',
            data: 'Hello!\na',
          });
          reporter.gotMessage(path, { type: 'finish', result: 'success', duration: 0 });
        },
        [
          /testStarted/,
          /##teamcity\[testStdOut name='test' out='Hello!\|na' flowId='\d+' timestamp='....-..-..T..:..:..\....'\]/,
          /testFinished/,
        ]
      );
    });

    it('should forward stderr', function () {
      return performActionsAndCheckOutput(
        function (reporter) {
          var path = { file: 'file', path: ['test'] };
          reporter.gotMessage(path, { type: 'start' });
          reporter.gotMessage(path, {
            type: 'stderr',
            data: 'Hello!\na',
          });
          reporter.gotMessage(path, { type: 'finish', result: 'success', duration: 0 });
        },
        [
          /testStarted/,
          /##teamcity\[testStdErr name='test' out='Hello!\|na' flowId='\d+' timestamp='....-..-..T..:..:..\....'\]/,
          /testFinished/,
        ]
      );
    });

    it('should forward stodut and stderr in order', function () {
      return performActionsAndCheckOutput(
        function (reporter) {
          var path = { file: 'file', path: ['test'] };
          reporter.gotMessage(path, { type: 'start' });
          reporter.gotMessage(path, {
            type: 'stderr',
            data: 'a',
          });
          reporter.gotMessage(path, {
            type: 'stdout',
            data: 'b',
          });
          reporter.gotMessage(path, {
            type: 'stderr',
            data: 'c',
          });
          reporter.gotMessage(path, {
            type: 'stdout',
            data: 'd',
          });
          reporter.gotMessage(path, { type: 'finish', result: 'success', duration: 0 });
        },
        [
          /testStarted/,
          /##teamcity\[testStdErr name='test' out='a' flowId='\d+' timestamp='....-..-..T..:..:..\....'\]/,
          /##teamcity\[testStdOut name='test' out='b' flowId='\d+' timestamp='....-..-..T..:..:..\....'\]/,
          /##teamcity\[testStdErr name='test' out='c' flowId='\d+' timestamp='....-..-..T..:..:..\....'\]/,
          /##teamcity\[testStdOut name='test' out='d' flowId='\d+' timestamp='....-..-..T..:..:..\....'\]/,
          /testFinished/,
        ]
      );
    });
  });

  describe('suiteStart/suiteEnd messages', function () {
    it('should emit testSuiteStarted and testSuiteFinished messages', function () {
      return performActionsAndCheckOutput(
        function (reporter) {
          var path = { file: 'file', path: ['suite', 'test'] };
          reporter.registerTests([path]);
          reporter.gotMessage(path, { type: 'start' });
          reporter.gotMessage(path, { type: 'finish', result: 'success', duration: 0 });
        },
        [
          /##teamcity\[testSuiteStarted name='suite' flowId='\d+' timestamp='....-..-..T..:..:..\....'\]/,
          /testStarted/,
          /testFinished/,
          /##teamcity\[testSuiteFinished name='suite' flowId='\d+' timestamp='....-..-..T..:..:..\....'\]/,
        ]
      );
    });

    it('should not emit testSuiteStarted or testSuiteFinished messages for top level anonymous suites', function () {
      return performActionsAndCheckOutput(
        function (reporter) {
          var path = { file: 'file', path: ['test'] };
          reporter.registerTests([path]);
          reporter.gotMessage(path, { type: 'start' });
          reporter.gotMessage(path, { type: 'finish', result: 'success', duration: 0 });
        },
        [/testStarted/, /testFinished/]
      );
    });
  });

  describe('error messages', function () {
    it('should emit testFailed messages', function () {
      return performActionsAndCheckOutput(
        function (reporter) {
          var path = { file: 'file', path: ['test'] };
          reporter.gotMessage(path, { type: 'start' });
          reporter.gotMessage(path, {
            type: 'error',
            stack: 'Line\nLine',
          });
          reporter.gotMessage(path, { type: 'finish', result: 'failure', duration: 0 });
        },
        [
          /testStarted/,
          /##teamcity\[testFailed name='test' message='Line' details='Line\|nLine' flowId='\d+' timestamp='....-..-..T..:..:..\....'\]/,
          /testFinished/,
        ]
      );
    });

    it('should emit testFailed messages when stack is missing', function () {
      return performActionsAndCheckOutput(
        function (reporter) {
          var path = { file: 'file', path: ['test'] };
          reporter.gotMessage(path, { type: 'start' });
          reporter.gotMessage(path, {
            type: 'error',
          });
          reporter.gotMessage(path, { type: 'finish', result: 'failure', duration: 0 });
        },
        [
          /testStarted/,
          // We don't really care about the error message in this case; just make sure not to crash
          /##teamcity\[testFailed name='test' message='.*' details='.*' flowId='\d+' timestamp='....-..-..T..:..:..\....'\]/,
          /testFinished/,
        ]
      );
    });

    it('should emit testFailed message only for the first error for a given test', function () {
      return performActionsAndCheckOutput(
        function (reporter) {
          var path = { file: 'file', path: ['test'] };
          reporter.gotMessage(path, { type: 'start' });
          reporter.gotMessage(path, {
            type: 'error',
            stack: 'One',
          });
          reporter.gotMessage(path, {
            type: 'error',
            stack: 'Two',
          });
          reporter.gotMessage(path, { type: 'finish', result: 'failure', duration: 0 });
        },
        [
          /testStarted/,
          /##teamcity\[testFailed name='test' message='One' details='One' flowId='\d+' timestamp='....-..-..T..:..:..\....'\]/,
          /testFinished/,
        ]
      );
    });

    it('should emit separate testFailed message for separate tests', function () {
      return performActionsAndCheckOutput(
        function (reporter) {
          // Need to emit real start/finish messages, otherwise the messages get trapped in the Serializer reporter
          var path1 = { file: 'file', path: ['test1'] };
          var path2 = { file: 'file', path: ['test2'] };
          reporter.gotMessage(path1, { type: 'start' });
          reporter.gotMessage(path1, {
            type: 'error',
            stack: 'One',
          });
          reporter.gotMessage(path1, { type: 'finish', result: 'failure', duration: 0 });
          reporter.gotMessage(path2, { type: 'start' });
          reporter.gotMessage(path2, {
            type: 'error',
            stack: 'Two',
          });
          reporter.gotMessage(path2, { type: 'finish', result: 'failure', duration: 0 });
        },
        [
          /testStarted/,
          /##teamcity\[testFailed name='test1' message='One' details='One' flowId='\d+' timestamp='....-..-..T..:..:..\....'\]/,
          /testFinished/,
          /testStarted/,
          /##teamcity\[testFailed name='test2' message='Two' details='Two' flowId='\d+' timestamp='....-..-..T..:..:..\....'\]/,
          /testFinished/,
        ]
      );
    });

    it('should emit comparisonFailure testFailed message for errors with actual and expected fields', function () {
      return performActionsAndCheckOutput(
        function (reporter) {
          var path = { file: 'file', path: ['test'] };
          reporter.gotMessage(path, { type: 'start' });
          reporter.gotMessage(path, {
            type: 'error',
            stack: 'Line\nLine',
            expected: 'expected',
            actual: 'actual',
          });
          reporter.gotMessage(path, { type: 'finish', result: 'failure' });
        },
        [
          /testStarted/,
          /##teamcity\[testFailed name='test' message='Line' details='Line\|nLine' type='comparisonFailure' expected='expected' actual='actual' flowId='\d+' timestamp='....-..-..T..:..:..\....'\]/,
          /testFinished/,
        ]
      );
    });
  });

  describe('start/finish messages', function () {
    it('should emit testStarted messages', function () {
      return performActionsAndCheckOutput(
        function (reporter) {
          var path = { file: 'file', path: ['test1'] };
          reporter.gotMessage(path, { type: 'start' });
          reporter.gotMessage(path, { type: 'finish', result: 'success' });
        },
        [
          /##teamcity\[testStarted name='test1' flowId='\d+' timestamp='....-..-..T..:..:..\....'\]/,
          /testFinished/,
        ]
      );
    });

    it('should emit testIgnored messages for skipped tests', function () {
      return performActionsAndCheckOutput(
        function (reporter) {
          var path = { file: 'file', path: ['test1'] };
          reporter.gotMessage(path, { type: 'start', skipped: true });
          reporter.gotMessage(path, { type: 'finish', result: 'success' });
        },
        [
          /##teamcity\[testIgnored name='test1' flowId='\d+' timestamp='....-..-..T..:..:..\....'\]/,
          /testFinished/,
        ]
      );
    });

    it('should emit error message for tests that time out', function () {
      return performActionsAndCheckOutput(
        function (reporter) {
          var path = { file: 'file', path: ['test1'] };
          reporter.gotMessage(path, { type: 'start' });
          reporter.gotMessage(path, { type: 'timeout' });
          reporter.gotMessage(path, { type: 'finish', result: 'failure' });
        },
        [
          /testStarted/,
          /##teamcity\[testFailed name='test1' message='Timed out: [^\']+' details='[^\']+' flowId='\d+' timestamp='....-..-..T..:..:..\....'\]/,
          /testFinished/,
        ]
      );
    });

    it('should emit only one error message for tests that both fail and time out', function () {
      return performActionsAndCheckOutput(
        function (reporter) {
          var path = { file: 'file', path: ['test1'] };
          reporter.gotMessage(path, { type: 'start' });
          reporter.gotMessage(path, { type: 'error', stack: 'Error' });
          reporter.gotMessage(path, { type: 'finish', result: 'timeout', duration: 0 });
        },
        [/testStarted/, /testFailed/, /testFinished/]
      );
    });

    it('should emit error message for tests that are aborted', function () {
      return performActionsAndCheckOutput(
        function (reporter) {
          var path = { file: 'file', path: ['test1'] };
          reporter.gotMessage(path, { type: 'start' });
          reporter.gotMessage(path, { type: 'finish', result: 'aborted' });
        },
        [
          /testStarted/,
          /##teamcity\[testFailed name='test1' message='Test aborted' flowId='\d+' timestamp='....-..-..T..:..:..\....'\]/,
          /testFinished/,
        ]
      );
    });

    it('should emit only one error message for tests that both fail and are aborted', function () {
      return performActionsAndCheckOutput(
        function (reporter) {
          var path = { file: 'file', path: ['test1'] };
          reporter.gotMessage(path, { type: 'start' });
          reporter.gotMessage(path, { type: 'error', stack: 'Error' });
          reporter.gotMessage(path, { type: 'finish', result: 'aborted' });
        },
        [/testStarted/, /testFailed/, /testFinished/]
      );
    });

    it('should emit error message for tests that fail without error message', function () {
      return performActionsAndCheckOutput(
        function (reporter) {
          var path = { file: 'file', path: ['test1'] };
          reporter.gotMessage(path, { type: 'start' });
          reporter.gotMessage(path, { type: 'finish', result: 'failure' });
        },
        [
          /testStarted/,
          /##teamcity\[testFailed name='test1' message='Test failed \(unknown reason\)' flowId='\d+' timestamp='....-..-..T..:..:..\....'\]/,
          /testFinished/,
        ]
      );
    });

    it('should emit testFinished for tests that time out', function () {
      return performActionsAndCheckOutput(
        function (reporter) {
          var path = { file: 'file', path: ['test1'] };
          reporter.gotMessage(path, { type: 'start' });
          reporter.gotMessage(path, { type: 'timeout' });
          reporter.gotMessage(path, { type: 'finish', result: 'failure' });
        },
        [
          /testStarted/,
          /testFailed/,
          /##teamcity\[testFinished name='test1' flowId='\d+' timestamp='....-..-..T..:..:..\....'\]/,
        ]
      );
    });

    it('should emit testFinished for tests that are aborted', function () {
      return performActionsAndCheckOutput(
        function (reporter) {
          var path = { file: 'file', path: ['test1'] };
          reporter.gotMessage(path, { type: 'start' });
          reporter.gotMessage(path, { type: 'finish', result: 'aborted' });
        },
        [
          /testStarted/,
          /testFailed/,
          /##teamcity\[testFinished name='test1' flowId='\d+' timestamp='....-..-..T..:..:..\....'\]/,
        ]
      );
    });

    it('should emit testFinished for tests that fail', function () {
      return performActionsAndCheckOutput(
        function (reporter) {
          var path = { file: 'file', path: ['test1'] };
          reporter.gotMessage(path, { type: 'start' });
          reporter.gotMessage(path, { type: 'finish', result: 'failure' });
        },
        [
          /testStarted/,
          /testFailed/,
          /##teamcity\[testFinished name='test1' flowId='\d+' timestamp='....-..-..T..:..:..\....'\]/,
        ]
      );
    });

    it('should not emit testFinished for tests that are skipped', function () {
      return performActionsAndCheckOutput(
        function (reporter) {
          var path = { file: 'file', path: ['test1'] };
          reporter.gotMessage(path, { type: 'start', skipped: true });
          reporter.gotMessage(path, { type: 'finish', result: 'skipped' });
        },
        [/testIgnored/]
      );
    });

    it('should treat timeout in before hook as error', function () {
      return performActionsAndCheckOutput(
        function (reporter) {
          var path = { file: 'file', path: ['test1'] };
          reporter.gotMessage(path, { type: 'start' });
          reporter.gotMessage(path, { type: 'startedBeforeHooks', data: 'a' });
          reporter.gotMessage(path, { type: 'timeout', data: 'b' });
          reporter.gotMessage(path, { type: 'startedTest', data: 'c' });
          reporter.gotMessage(path, { type: 'error', data: 'd', stack: 'Error' });
          reporter.gotMessage(path, { type: 'finish', result: 'timeout' });
        },
        [
          /testStarted/,
          /##teamcity\[testFailed name='test1' message='Timed out: [^\']+' details='[^\']+' flowId='\d+' timestamp='....-..-..T..:..:..\....'\]/,
          /##teamcity\[testFinished name='test1' flowId='\d+' timestamp='....-..-..T..:..:..\....'\]/,
        ]
      );
    });
  });

  describe('Retry handling', function () {
    it('should ignore previous failures if a retry succeeds', function () {
      return performActionsAndCheckOutput(
        function (reporter) {
          var path = { file: 'file', path: ['test1'] };
          reporter.gotMessage(path, { type: 'start' });
          reporter.gotMessage(path, { type: 'error', data: 'd', stack: 'Error' });
          reporter.gotMessage(path, { type: 'retry', result: 'failure' });
          reporter.gotMessage(path, { type: 'finish', result: 'success' });
        },
        [/testStarted/, /testFinished/]
      );
    });

    it('should emit error for the last failing test when retries happen', function () {
      return performActionsAndCheckOutput(
        function (reporter) {
          var path = { file: 'file', path: ['test1'] };
          reporter.gotMessage(path, { type: 'start' });
          reporter.gotMessage(path, { type: 'error', data: 'd', stack: 'Error' });
          reporter.gotMessage(path, { type: 'retry', result: 'failure' });
          reporter.gotMessage(path, { type: 'error', data: 'e', stack: 'Error' });
          reporter.gotMessage(path, { type: 'finish', result: 'failure' });
        },
        [
          /testStarted/,
          /##teamcity\[testFailed name='test1' message='Error' details='Error' flowId='\d+' timestamp='....-..-..T..:..:..\....'\]/,
          /testFinished/,
        ]
      );
    });

    it('should ignore previous timeouts if a retry succeeds', function () {
      return performActionsAndCheckOutput(
        function (reporter) {
          var path = { file: 'file', path: ['test1'] };
          reporter.gotMessage(path, { type: 'start' });
          reporter.gotMessage(path, { type: 'retry', result: 'timeout' });
          reporter.gotMessage(path, { type: 'finish', result: 'success' });
        },
        [/testStarted/, /testFinished/]
      );
    });
  });
});
