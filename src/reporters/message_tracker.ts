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
import Reporter from './reporter';

function testPathToKey(testPath: TestPath) {
  return JSON.stringify(testPath);
}

/**
 * MessageTracker is a very basic reporter (in the sense that it conforms to the
 * reporter interface) that does nothing but keep track of messages of a given type
 * that tests emit.
 *
 * It doesn't actually report anything anywhere but it exposes an accessor for
 * getting the relevant messages that a test has emitted so far.
 *
 * This is useful for example when not immediately showing errors or breadcrumbs for
 * tests.
 */
export default class MessageTracker<T extends Message> implements Reporter {
  #messages = new Map<string, T[]>();
  #didTimeOut = new Set<string>();

  constructor(private messageType: T['type']) {}

  private addMessage(testPath: TestPath, message: T) {
    const key = testPathToKey(testPath);
    this.#messages.set(key, [...this.getMessages(testPath), message]);
  }

  private testTimedOut(testPath: TestPath) {
    return this.#didTimeOut.has(testPathToKey(testPath));
  }

  getMessages(testPath: TestPath) {
    const key = testPathToKey(testPath);
    return this.#messages.get(key) ?? [];
  }

  gotMessage(testPath: TestPath, message: Message) {
    if (message.type === this.messageType) {
      if (!this.testTimedOut(testPath)) {
        this.addMessage(testPath, message as T);
      }
    } else if (message.type === 'timeout') {
      this.#didTimeOut.add(testPathToKey(testPath));
    } else if (message.type === 'retry') {
      const key = testPathToKey(testPath);
      this.#messages.set(key, []);
      this.#didTimeOut.delete(key);
    }
  }
}
