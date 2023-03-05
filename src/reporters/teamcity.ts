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

import tsm = require('teamcity-service-messages');
import Serializer from './serializer';
import SuiteMarker from './suite_marker';
import * as errorMessageUtil from '../error_message_util';
import MessageTracker from './message_tracker';
import PhaseTracker from './phase_tracker';
import { BreadcrumbMessage, ErrorMessage, FinishMessage, Message } from './message';
import { Writable } from 'stream';
import { TestPath } from '../test_path';
import Reporter from './reporter';

const teamcityServiceMessages = tsm as unknown as tsm.API<false>;
teamcityServiceMessages.stdout = false; // Global yuck :-(

// Documentation for the TeamCity reporter format:
// https://confluence.jetbrains.com/display/TCD65/Build+Script+Interaction+with+TeamCity#BuildScriptInteractionwithTeamCity-ReportingTests

/**
 * Teamcity is a reporter that reports test results in Teamcity's message
 * format.
 */
export class Teamcity<T extends FinishMessage> implements Reporter<Message<T>> {
  // Keys are JSON testPath, value is true if an error has been emitted for that test
  _emittedErrorForTest = new Set<string>();
  _errorTracker = new MessageTracker<ErrorMessage>('error');
  _breadcrumbTracker = new MessageTracker<BreadcrumbMessage>('breadcrumb');
  _phaseTracker = new PhaseTracker();
  _bufferedTestOutput = new Map<string, string>();

  constructor(private _stream: Writable) {}

  registrationFailed(error: Error) {
    const name = 'Processing of test files';
    this._write(teamcityServiceMessages.testStarted({ name: name }));
    this._write(
      teamcityServiceMessages.testFailed({
        name,
        message: 'Error when loading the test files',
        details: error.stack,
      })
    );
    this._write(teamcityServiceMessages.testFinished({ name: name }));
  }

  private _write(string: string) {
    this._stream.write(string + '\n');
  }

  private _bufferTestOutput(testPath: TestPath, output: string) {
    const key = JSON.stringify(testPath);
    const prevOutput = this._bufferedTestOutput.get(key);
    this._bufferedTestOutput.set(key, `${prevOutput ?? ''}${output}\n`);
  }

  private _writeBufferedOutput(testPath: TestPath) {
    const key = JSON.stringify(testPath);
    this._stream.write(this._bufferedTestOutput.get(key) ?? '');
  }

  private _clearBufferedOutput(testPath: TestPath) {
    const key = JSON.stringify(testPath);
    this._bufferedTestOutput.set(key, '');
    this._emittedErrorForTest.delete(key);
  }

  private _emitErrorForTest(
    testPath: TestPath,
    args: tsm.TestFailedArgs | tsm.TestComparisonFailureArgs
  ) {
    // According to the TC spec, only one testFailed should be emitted per test
    const key = JSON.stringify(testPath);
    if (!this._emittedErrorForTest.has(key)) {
      this._emittedErrorForTest.add(key);
      this._bufferTestOutput(testPath, teamcityServiceMessages.testFailed(args));
    }
  }

  gotMessage(testPath: TestPath, message: Message<T>) {
    const testName = testPath?.path.at(-1) ?? '';
    const suiteName = 'suite' in message ? message.suite.path.join(' ') : undefined;

    this._phaseTracker.gotMessage(testPath, message);
    this._errorTracker.gotMessage(testPath, message);
    this._breadcrumbTracker.gotMessage(testPath, message);

    if (message.type === 'stdout') {
      // ##teamcity[testStdOut name='testname' out='text']
      this._bufferTestOutput(
        testPath,
        teamcityServiceMessages.testStdOut({ name: testName, out: message.data })
      );
    } else if (message.type === 'stderr') {
      // ##teamcity[testStdErr name='testname' out='error text']
      this._bufferTestOutput(
        testPath,
        teamcityServiceMessages.testStdErr({ name: testName, out: message.data })
      );
    } else if (message.type === 'suiteStart') {
      if (suiteName) {
        // suiteName is '' for the top level file suite
        // ##teamcity[testSuiteStarted name='suite.name']
        this._write(teamcityServiceMessages.testSuiteStarted({ name: suiteName }));
      }
    } else if (message.type === 'suiteFinish') {
      if (suiteName) {
        // suiteName is '' for the top level file suite
        //##teamcity[testSuiteFinished name='suite
        this._write(teamcityServiceMessages.testSuiteFinished({ name: suiteName }));
      }
    } else if (message.type === 'timeout') {
      // ##teamcity[testFailed name='test1' message='Test timed out' details='message and stack trace']

      const msgs: string[] = [];

      const errors = this._errorTracker.getMessages(testPath);

      errors.forEach((error) =>
        msgs.push(errorMessageUtil.indent(errorMessageUtil.prettyError(error)) + '\n')
      );

      const lastPhase = this._phaseTracker.getLastPhase(testPath);
      msgs.push(errorMessageUtil.indent(errorMessageUtil.prettyTimeout(lastPhase)));

      const breadcrumb = this._breadcrumbTracker.getMessages(testPath).at(-1);
      if (breadcrumb) {
        const breadcrumbString = errorMessageUtil.prettyBreadcrumb(breadcrumb, 'Last breadcrumb');
        msgs.push(errorMessageUtil.indent(breadcrumbString));
      }

      const timeoutMessage = {
        name: testName,
        message: 'Timed out: ' + (breadcrumb ? breadcrumb.message : 'missing breadcrumb'),
        details: msgs.join('\n'),
      };
      this._emitErrorForTest(testPath, timeoutMessage);
    } else if (message.type === 'error') {
      // possibly: ##teamcity[testFailed name='test1' message='failure message' details='message and stack trace']
      // possibly: ##teamcity[testFailed type='comparisonFailure' name='test2' message='failure message' details='message and stack trace' expected='expected value' actual='actual value']
      const stack = typeof message.stack === 'string' ? message.stack : JSON.stringify(message);
      const errorMessage = {
        name: testName,
        message: stack.split(/\n/)[0],
        details: stack,
      };

      if ('expected' in message && 'actual' in message && message.expected && message.actual) {
        Object.assign(errorMessage, {
          type: 'comparisonFailure',
          expected: message.expected,
          actual: message.actual,
        });
      }

      this._emitErrorForTest(testPath, errorMessage);
    } else if (message.type === 'start' || message.type === 'retry') {
      this._clearBufferedOutput(testPath);
      const name = testName + (message.unstable ? ' [unstable]' : '');

      // for skipped tests: ##teamcity[testIgnored name='testname' message='ignore comment']
      // for other tests: ##teamcity[testStarted name='testname']
      if ('skipped' in message && message.skipped) {
        this._bufferTestOutput(testPath, teamcityServiceMessages.testIgnored({ name: name }));
      } else {
        this._bufferTestOutput(testPath, teamcityServiceMessages.testStarted({ name: name }));
      }
    } else if (message.type === 'finish') {
      if (message.result === 'aborted') {
        this._emitErrorForTest(testPath, { name: testName, message: 'Test aborted' });
      } else if (message.result === 'failure') {
        // This should really never happen, but it could if the test just exits
        // with a non-zero exit status.
        this._emitErrorForTest(testPath, {
          name: testName,
          message: 'Test failed (unknown reason)',
        });
      }

      // and then: ##teamcity[testFinished name='testname' duration='50']
      if (message.result !== 'skipped') {
        const finishedMsg = { name: testName ?? '' };
        if ('duration' in message) {
          Object.assign(finishedMsg, { duration: message.duration });
        }
        this._bufferTestOutput(testPath, teamcityServiceMessages.testFinished(finishedMsg));
      }

      this._writeBufferedOutput(testPath);
    }
  }
}

export default function <T extends FinishMessage>(stream: Writable) {
  return new Serializer(new SuiteMarker(new Teamcity<T>(stream)));
}
