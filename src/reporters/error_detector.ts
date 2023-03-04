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

/**
 * ErrorDetector is a reporter mainly for internal use by the suite
 * runner. It remembers if any of the tests runs failed.
 */
export default class ErrorDetector implements Reporter {
  #didFail = false;
  #testPath: TestPath | null = null;
  #message: Message | null = null;

  gotMessage(testPath: TestPath, message: Message) {
    if (message.type === 'finish' && !['success', 'skipped'].includes(message.result)) {
      this.#didFail = true;
      this.#testPath = testPath;
      this.#message = message;
    }
  }

  didFail() {
    return this.#didFail;
  }

  testPath() {
    return this.#testPath;
  }

  message() {
    return this.#message;
  }
}
