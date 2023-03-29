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

import { TestPath } from '../test_path';
import { Message } from './message';
import { RegisterOptions } from './reporter';
import InternalReporter from './internal_reporter';

/**
 * CancellableReporter is a reporter mainly for internal use by the suite runner. It
 * forwards all messages to another reporter, except for when it's been
 * "cancelled". When the CancellableReporter is cancelled, it will emit "aborted" finish
 * messages for all currently running tests and then ignore all subsequent
 * messages.
 *
 * This is used in the suite runner to be able to implement cancellation in a
 * nice way that doesn't require everything to know about cancellation.
 */
export default class CancellableReporter implements InternalReporter {
  #isFinished = false;
  #registerTestsCalled = false;
  #outstandingTests = new Set<string>();

  constructor(private reporter: InternalReporter) {}

  registerTests(tests: TestPath[], options: RegisterOptions) {
    this.#registerTestsCalled = true;
    !this.#isFinished && this.reporter.registerTests(tests, options);
  }

  registrationFailed(error: Error) {
    !this.#isFinished && this.reporter.registrationFailed(error);
    this.#isFinished = true;
  }

  gotMessage(testPath: TestPath, message: Message) {
    const key = JSON.stringify(testPath);
    if (message.type === 'start') {
      this.#outstandingTests.add(key);
    } else if (message.type === 'finish') {
      this.#outstandingTests.delete(key);
    }

    !this.#isFinished && this.reporter.gotMessage(testPath, message);
  }

  done() {
    !this.#isFinished && this.reporter.done();
    this.#isFinished = true;
  }

  cancel() {
    this.#isFinished = true;

    this.#outstandingTests.forEach((key) => {
      const testPath = JSON.parse(key);
      this.reporter.gotMessage(testPath, { type: 'finish', result: 'aborted' });
    });

    this.#registerTestsCalled && this.reporter.done();
  }

  isFinished() {
    return this.#isFinished;
  }
}
