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
import Combined from './combined';
import { Message, MessageWithSlowness } from './message';
import Reporter, { RegisterOptions } from './reporter';

/**
 * Timer is a reporter for internal use by the suite runner. It forwards all
 * messages to another reporter, but also adds "time", "slow" and "halfSlow"
 * fields to finish messages.
 *
 * This is used in the suite runner as a way to move logic out of that file.
 */
export default class Timer extends Combined<MessageWithSlowness> {
  // Is set in registerTests
  _defaultSlowThreshold: number | undefined;
  _slowThresholdOverrides = new Map<string, number>();
  _testStartTime = new Map<string, number>();
  _testDoneTime = new Map<string, number>();

  constructor(reporter: Reporter<MessageWithSlowness>) {
    super([reporter]);
  }

  private getSlowThresholdForTest(key: string) {
    return this._slowThresholdOverrides.get(key) ?? this._defaultSlowThreshold ?? 0;
  }

  private setSlowThresholdForTest(key: string, value: number) {
    this._slowThresholdOverrides.set(key, value);
  }

  registerTests(tests: TestPath[], options: RegisterOptions, time: Date) {
    super.registerTests(tests, options, time);
    this._defaultSlowThreshold = options.slowThreshold;
  }

  gotMessage(testPath: TestPath, message: Message, time: Date) {
    let messageWithSlowness: MessageWithSlowness;

    const key = JSON.stringify(testPath);

    if (message.type === 'finish') {
      const [done, start] = [this._testDoneTime.get(key), this._testStartTime.get(key)];
      let duration: number | undefined;
      let [slow, halfSlow] = [false, false];

      if (done && start) {
        duration = done - start;
        const slowThreshold = this.getSlowThresholdForTest(key);
        [slow, halfSlow] = [duration >= slowThreshold, duration >= slowThreshold / 2];
      }
      messageWithSlowness = { ...message, duration, slow, halfSlow };
    } else {
      if (message.type === 'startedTest') {
        this._testStartTime.set(key, time.getTime());
      } else if (message.type === 'startedAfterHooks') {
        this._testDoneTime.set(key, time.getTime());
      } else if (message.type === 'setSlowThreshold') {
        this.setSlowThresholdForTest(key, message.value);
      }
      messageWithSlowness = message;
    }

    super.gotMessage(testPath, messageWithSlowness, time);
  }
}
