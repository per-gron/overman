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

import TestCount from '../test_count';
import { TestPath } from '../test_path';
import { suitePathOf } from '../test_path_util';
import Combined from './combined';
import { FinishMessage, Message } from './message';
import Reporter, { RegisterOptions } from './reporter';

/**
 * SuiteMarker is a reporter that emits extra messages that contain information
 * about when a test suite has started and when it is finished. Before any test
 * that is within a suite (direct child or ancestor) runs, a 'suiteStart'
 * message is emitted. After the last test in a suite has run, a 'suiteFinish'
 * message is emitted. The messages are emitted with suite path and have the
 * format
 *
 *   { "type": ["suiteStart"|"suiteFinish"], "suite": [suite path] }
 *
 * Suites that don't have any tests are not reported.
 *
 * The SuiteMarker reporter can be run directly, but I expect it to most often
 * be used together with the Serializer reporter; that way, the receiving
 * reporter will get messages as if the tests are run serially and with
 * information about when suites start and end.
 */
export default class SuiteMarker<T extends FinishMessage> extends Combined<Message<T>> {
  _totalTests = new TestCount();
  _remainingTests = new TestCount();

  constructor(reporter: Reporter<Message<T>>) {
    super([reporter]);
  }

  private maybeEmitSuiteStart(suitePath: TestPath | null, time: Date) {
    if (suitePath === null) {
      return;
    }

    const totalTestsInSuite = this._totalTests.numberOfTestsInSuite(suitePath);
    const remainingTestsInSuite = this._remainingTests.numberOfTestsInSuite(suitePath);
    if (totalTestsInSuite === remainingTestsInSuite) {
      this.maybeEmitSuiteStart(suitePathOf(suitePath), time);
      super.gotMessage(suitePath, { type: 'suiteStart', suite: suitePath }, time);
    }
  }

  private maybeEmitSuiteFinish(suitePath: TestPath | null, time: Date) {
    if (suitePath !== null && this._remainingTests.numberOfTestsInSuite(suitePath) === 0) {
      super.gotMessage(suitePath, { type: 'suiteFinish', suite: suitePath }, time);
      this.maybeEmitSuiteFinish(suitePathOf(suitePath), time);
    }
  }

  registerTests(tests: TestPath[], opts: RegisterOptions, time: Date) {
    super.registerTests(tests, opts, time);
    this._totalTests.addTests(tests);
    this._remainingTests.addTests(tests);
  }

  gotMessage(testPath: TestPath, message: Message<T>, time: Date) {
    const suitePath = suitePathOf(testPath);

    if (message.type === 'start') {
      this.maybeEmitSuiteStart(suitePath, time);
      this._remainingTests.removeTest(testPath);
    }

    super.gotMessage(testPath, message, time);

    if (message.type === 'finish') {
      this.maybeEmitSuiteFinish(suitePath, time);
    }
  }
}
