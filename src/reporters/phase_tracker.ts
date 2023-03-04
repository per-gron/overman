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

import { ErrorLocation } from '../error_message_util';
import { TestPath } from '../test_path';
import { Message } from './message';
import Reporter from './reporter';

export type Phase = ErrorLocation;

/**
 * PhaseTracker is a very basic reporter (in the sense that it conforms to the
 * reporter interface) that does nothing but keep track of where a test was
 * last (ie which hook it was in or if it was in the test).
 *
 * It doesn't actually report anything anywhere but it exposes an accessor for
 * getting the last phase of a test.
 *
 * This is useful when showing error messages for tests that time out: It is
 * helpful to say what timed out.
 */
export default class PhaseTracker implements Reporter {
  #prevPhase = new Map<string, Phase>();
  #didTimeOut = new Set<string>();

  gotMessage(testPath: TestPath, message: Message) {
    const key = JSON.stringify(testPath);

    if (message.type === 'retry') {
      this.#prevPhase.delete(key);
      this.#didTimeOut.delete(key);
    } else if (message.type === 'timeout') {
      this.#didTimeOut.add(key);
    } else if (this.#didTimeOut.has(key)) {
      // Do nothing; if the test timed out, we don't want to store any more.
      // Otherwise we will always report that the test timed out in after
      // hooks, even though that might not be the case.
    } else if (message.type === 'startedBeforeHook') {
      this.#prevPhase.set(key, { in: 'beforeHook', inName: message.name });
    } else if (message.type === 'startedTest') {
      this.#prevPhase.set(key, { in: 'test' });
    } else if (message.type === 'startedAfterHook') {
      this.#prevPhase.set(key, { in: 'afterHook', inName: message.name });
    }
  }

  getLastPhase(path: TestPath) {
    return this.#prevPhase.get(JSON.stringify(path));
  }
}
