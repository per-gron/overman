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
import Reporter, { RegisterOptions } from './reporter';

/**
 * Combined is a reporter mainly for internal use by the suite
 * runner. It forwards all messages to other reporters.
 */
export default class Combined<T extends Message = Message> implements Reporter<T> {
  constructor(private reporters: Reporter<T>[] = []) {}

  registerTests(tests: TestPath[], options: RegisterOptions, time: Date) {
    this.reporters.forEach((reporter) => reporter.registerTests?.(tests, options, time));
  }

  registrationFailed(error: Error, time: Date) {
    this.reporters.forEach((reporter) => reporter.registrationFailed?.(error, time));
  }

  gotMessage(testPath: TestPath, message: T, time: Date) {
    this.reporters.forEach((reporter) => reporter.gotMessage?.(testPath, message, time));
  }

  done(time: Date) {
    this.reporters.forEach((reporter) => reporter.done?.(time));
  }
}
