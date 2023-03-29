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

import * as chalk from 'chalk';
import { Chalk } from 'chalk';
import { Writable } from 'stream';
import prettyDuration from '../pretty_duration';
import { TestPath } from '../test_path';
import { FinishMessage, Message } from './message';
import Reporter, { RegisterOptions } from './reporter';

const colors: Record<string, Chalk> = {
  success: chalk.green,
  failure: chalk.red,
  skipped: chalk.cyan,
  aborted: chalk.yellow,
  time: chalk.grey,
};

/**
 * Summary is a reporter that monitors the results of the tests and when all the
 * tests have run, it prints out a summary that counts the number of tests that
 * passed, failed or timed out.
 *
 * @param stream The stream to print to.
 */
export default class Summary implements Reporter {
  _startedAt: Date | undefined;
  _numResultsOfType = new Map<FinishMessage['result'], number>();

  constructor(private _stream: Writable) {}

  registerTests(_path: TestPath[], _opts: RegisterOptions, time: Date) {
    this._startedAt = time;
  }

  gotMessage(_: TestPath, message: Message) {
    if (message.type === 'finish') {
      const count = this._numResultsOfType.get(message.result);
      this._numResultsOfType.set(message.result, (count ?? 0) + 1);
    }
  }

  done(time: Date) {
    if (!this._startedAt) {
      throw new Error();
    }
    const timeSinceStart = time.getTime() - this._startedAt.getTime();

    this._stream.write(
      '\n  ' + colors.success((this._numResultsOfType.get('success') || 0) + ' passing')
    );
    this._stream.write(' ' + colors.time('(' + prettyDuration(timeSinceStart) + ')') + '\n');

    const skipped = this._numResultsOfType.get('skipped');
    if (skipped) {
      this._stream.write('  ' + colors.skipped(skipped + ' skipped') + '\n');
    }
    const failure =
      (this._numResultsOfType.get('failure') ?? 0) + (this._numResultsOfType.get('timeout') ?? 0);
    if (failure) {
      this._stream.write('  ' + colors.failure(failure + ' failing') + '\n');
    }
    const aborted = this._numResultsOfType.get('aborted');
    if (aborted) {
      this._stream.write('  ' + colors.aborted(aborted + ' aborted') + '\n');
    }
    this._stream.write('\n');
  }
}
