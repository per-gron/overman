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
import InternalReporter from './internal_reporter';

/**
 * TimestamperReporter is a reporter mainly for internal use by the suite runner.
 * It forwards all messages to a Reporter (public API), and adds the timestamp
 * as required by the Reporter API.
 *
 * At first, I added the logic for doing this to the suite runner itself, but
 * the code got quite messy so it's extracted to a separate file with this.
 */
export default class TimestamperReporter implements InternalReporter {
  constructor(private _reporter: Reporter, private _clock: () => Date) {}

  registerTests(tests: TestPath[], options: RegisterOptions) {
    this._reporter.registerTests?.(tests, options, this._clock());
  }
  registrationFailed(error: Error) {
    this._reporter.registrationFailed?.(error, this._clock());
  }
  gotMessage(testPath: TestPath, message: Message) {
    this._reporter.gotMessage?.(testPath, message, this._clock());
  }
  done() {
    this._reporter.done?.(this._clock());
  }
}
