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

import * as testPathUtil from '../test_path_util';
import TestCount from '../test_count';
import { TestPath } from '../test_path';
import { FinishMessage, Message } from './message';
import Reporter, { RegisterOptions } from './reporter';

function suiteIsAncestorOfOrSameAs(ancestor: TestPath, descendant: TestPath) {
  return (
    ancestor.file === descendant.file &&
    ancestor.path.length <= descendant.path.length &&
    ancestor.path.every((seg, i) => seg === descendant.path[i])
  );
}

/**
 * Serializer is a reporter that takes a stream of tests running potentially
 * in parallel and converts it to a stream of messages that seem like the tests
 * are running sequentially. It does this by delaying messages when necessary.
 *
 * Tests will be serialized so that if a test in a given suite has started, its
 * suite will be completely finished until any other non-descendant suite test
 * is started. This means that if a test starts running and it belongs to a new
 * suite, it is safe to print that suite name to stdout, and it will not have
 * to be printed again because the suite will finish before anything else is
 * reported.
 *
 * This is useful for use by reporters that don't support parallelism.
 */
export default class Serializer<T extends FinishMessage> implements Reporter<Message<T>> {
  _currentTest: string | null = null;
  _canPickNewTest = true;
  // Map from serialized test path to array of suppressed messages
  _pendingTestMessages = new Map<string, Message<T>[]>();
  _remainingTests = new TestCount();

  // Used for providing helpful errors
  _finishedTests = new Set<string>();

  constructor(private _reporter: Reporter<Message<T>>) {
    // Serialized test path
  }

  private _storeMessageForLater(serializedTestPath: string, message: Message<T>) {
    const messages = this._pendingTestMessages.get(serializedTestPath) ?? [];
    this._pendingTestMessages.set(serializedTestPath, [...messages, message]);
  }

  /**
   * Emits pending messages for a given test and clears them from the queue.
   */
  private _emitPendingMessagesForTest(testPath: TestPath, time: Date) {
    const serializedTestPath = JSON.stringify(testPath);
    const pendingMessages = this._pendingTestMessages.get(serializedTestPath) ?? [];
    if (this._reporter.gotMessage) {
      pendingMessages.forEach((message) => this._reporter.gotMessage!(testPath, message, time));
    }
    this._pendingTestMessages.delete(serializedTestPath);
  }

  private _pendingTestHasFinished(testPath: TestPath) {
    return this._pendingTestMessages.get(JSON.stringify(testPath))?.at(-1)?.type === 'finish';
  }

  private _currentTestFinished() {
    if (this._currentTest) {
      this._finishedTests.add(this._currentTest);
      this._remainingTests.removeTest(JSON.parse(this._currentTest));
    }
    this._canPickNewTest = true;
  }

  /**
   * Given the current test suite, finds out which suite the next test that we choose
   * must be part of.
   *
   * A null return value means that any test can be chosen.
   */
  private _getPremissibleSuiteForNextTest(currentSuite: TestPath): TestPath | null {
    if (currentSuite.path.length === 0) {
      return null;
    } else if (this._remainingTests.numberOfTestsInSuite(currentSuite) !== 0) {
      return currentSuite;
    } else {
      return this._getPremissibleSuiteForNextTest(testPathUtil.suitePathOf(currentSuite)!);
    }
  }

  private _getPermissibleNextTests() {
    const allPendingTests = [...this._pendingTestMessages.keys()].map<TestPath>((key) =>
      JSON.parse(key)
    );

    const permissibleSuiteForNextTest =
      this._currentTest &&
      this._getPremissibleSuiteForNextTest(
        testPathUtil.suitePathOf(JSON.parse(this._currentTest))!
      );

    if (permissibleSuiteForNextTest) {
      return allPendingTests.filter((testPath) =>
        suiteIsAncestorOfOrSameAs(permissibleSuiteForNextTest, testPath)
      );
    } else {
      return allPendingTests;
    }
  }

  private _getNextTest() {
    const permissiblePendingTests = this._getPermissibleNextTests();

    if (permissiblePendingTests.length === 0) {
      return null;
    } else {
      const finishedPendingTest = permissiblePendingTests.find((seg) =>
        this._pendingTestHasFinished(seg)
      );
      return finishedPendingTest || permissiblePendingTests.at(0);
    }
  }

  private _pickNewCurrentTest(time: Date) {
    const nextTest = this._getNextTest();

    if (nextTest) {
      const nextTestHasFinished = this._pendingTestHasFinished(nextTest);
      this._currentTest = JSON.stringify(nextTest);
      this._emitPendingMessagesForTest(nextTest, time);
      this._canPickNewTest = nextTestHasFinished;

      if (this._canPickNewTest) {
        this._currentTestFinished();
        this._pickNewCurrentTest(time);
      }
    }
  }

  registerTests(testPaths: TestPath[], options: RegisterOptions, time: Date) {
    this._remainingTests.addTests(testPaths);

    this._reporter.registerTests?.(testPaths, options, time);
  }

  registrationFailed(error: Error, time: Date) {
    this._reporter.registrationFailed?.(error, time);
  }

  gotMessage(testPath: TestPath, message: Message<T>, time: Date) {
    const serializedTestPath = JSON.stringify(testPath);

    if (this._finishedTests.has(serializedTestPath)) {
      throw new Error(
        'Got message (type ' +
          message.type +
          ') for test that has already finished: ' +
          serializedTestPath
      );
    }

    if (this._currentTest === serializedTestPath) {
      this._reporter.gotMessage?.(testPath, message, time);

      if (message.type === 'finish') {
        this._currentTestFinished();
      }
    } else {
      this._storeMessageForLater(serializedTestPath, message);
    }

    if (this._canPickNewTest) {
      this._pickNewCurrentTest(time);
    }
  }

  done(time: Date) {
    if (this._pendingTestMessages.size !== 0 || !this._canPickNewTest) {
      throw new Error('Got start messages that were not matched with finish messages');
    }

    this._reporter.done?.(time);
  }
}
