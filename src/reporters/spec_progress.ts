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
import * as readline from 'readline';
import { Writable } from 'stream';
import * as through from 'through';
import InsertionLog from '../insertion_log';
import { TestPath } from '../test_path';
import { suitePathOf } from '../test_path_util';
import { MessageWithSlowness } from './message';
import Reporter from './reporter';

function spacesForPath(path: TestPath) {
  return ' '.repeat(path.path.length * 2);
}

const SYMBOLS: Record<string, string> = {
  inProgress: ' ',
  success: '✓',
  failure: '✖',
  timeout: '⧖',
  skipped: '-',
  aborted: '-',
};

type Palette = Record<string, Chalk>;

const SYMBOL_COLORS: Palette = {
  inProgress: chalk.grey,
  success: chalk.green,
  failure: chalk.red,
  timeout: chalk.red,
  skipped: chalk.cyan,
  aborted: chalk.yellow,
};

const NAME_COLORS: Palette = {
  skipped: chalk.cyan,
  failure: chalk.red,
  timeout: chalk.red,
  aborted: chalk.yellow,
  defaultColor: chalk.grey,
};

const SLOWNESS_COLORS: Palette = {
  slow: chalk.red,
  halfSlow: chalk.yellow,
};

function color(palette: Palette, name: string) {
  return palette[name] ?? palette.defaultColor ?? ((x) => x);
}

function getLine(testPath: TestPath, unstable?: boolean, result?: string, breadcrumb?: string) {
  const name = testPath.path.at(-1) + (unstable ? ' [unstable]' : '');

  const status = result ?? 'inProgress';
  const symbolColor = color(SYMBOL_COLORS, status);
  const sign = SYMBOLS[status] ?? '?';
  const nameColor = color(NAME_COLORS, status);
  breadcrumb = breadcrumb ? `  >  ${breadcrumb}` : '';
  return `${spacesForPath(testPath)}${symbolColor(sign)} ${nameColor(name)}${breadcrumb}`;
}

export type InsertionLogLike = Pick<InsertionLog, 'log' | 'logAfter' | 'replace'>;

/**
 * SpecProgress is a reporter that emits the progress of tests while they run
 * to a given stream. It does not print any test output other than the list of
 * test names and their results coded as checkmarks or crosses. It does not
 * print a summary of how the tests went at the end; for this reason it is
 * typically used together with some other summary reporter.
 *
 * SpecProgress uses InsertionLog to print progress of tests as they run in
 * parallel. This means that the output will be borked unless the stream is
 * printed to a terminal that supports overwriting already written text. If
 * the output does not support this, the Serializer reporter can be used to
 * print tests as if they were run serially.
 */
export default class SpecProgress implements Reporter<MessageWithSlowness> {
  _log: InsertionLogLike;
  _disableBreadcrumbs: boolean;
  // The reporter needs to be able to insert new lines for tests and place
  // them where they belong. This is done by keeping track of ids for the
  // last line that was inserted for each test suite.
  _lastLineIdForSuite = new Map<string, string>();
  _isUnstable = new Set<string>();
  _recentBreadcrumb = new Map<string, string>();
  _stdio = new Map<string, { stdout: Writable; stderr: Writable }>();

  constructor(
    streams: { stdout: Writable; disableBreadcrumbs?: boolean },
    insertionLogFactory?: (stdout: Writable) => InsertionLogLike
  ) {
    const { stdout, disableBreadcrumbs = false } = streams ?? {};
    this._log = insertionLogFactory ? insertionLogFactory(stdout) : new InsertionLog(stdout);
    this._disableBreadcrumbs = disableBreadcrumbs;
  }

  private makePipedStream(id: string) {
    const input = through();
    const lines = readline.createInterface({ input, output: through() });

    const idForCounter = (counter: number) => id + (counter ? `_${counter}` : '');

    let counter = 0;

    lines.on('line', (line) => {
      this._log.logAfter(idForCounter(counter), line, idForCounter(counter + 1));
      counter++;
    });

    return input;
  }

  gotMessage(testPath: TestPath, message: MessageWithSlowness) {
    const pathAsString = JSON.stringify(testPath);

    if (message.type === 'suiteStart') {
      const suitePath = message.suite;
      const suitePathString = JSON.stringify(suitePath);
      const suiteName = suitePath.path.at(-1) || '';

      this._log.log(spacesForPath(suitePath) + suiteName, suitePathString);
      this._lastLineIdForSuite.set(suitePathString, suitePathString);
    } else if (message.type === 'breadcrumb' && testPath && !this._disableBreadcrumbs) {
      this._recentBreadcrumb.set(pathAsString, message.message);
      const line = getLine(
        testPath,
        this._isUnstable.has(pathAsString),
        undefined,
        message.message
      );
      this._log.replace(pathAsString, line);
    } else if (message.type === 'stdout') {
      this._stdio.get(pathAsString)?.stdout.write(message.data);
    } else if (message.type === 'stderr') {
      this._stdio.get(pathAsString)?.stderr.write(message.data);
    } else if (message.type === 'start' || message.type === 'finish') {
      const suitePathAsString = JSON.stringify(suitePathOf(testPath));
      if (message.type === 'start') {
        const line = getLine(testPath, message.unstable);
        const lineId = this._lastLineIdForSuite.get(suitePathAsString);
        lineId && this._log.logAfter(lineId, line, pathAsString);
        this._lastLineIdForSuite.set(suitePathAsString, pathAsString);

        message.unstable
          ? this._isUnstable.add(pathAsString)
          : this._isUnstable.delete(pathAsString);
        this._stdio.set(pathAsString, {
          stdout: this.makePipedStream(pathAsString),
          stderr: this.makePipedStream(pathAsString),
        });
      } else if (message.type === 'finish') {
        let line = getLine(testPath, message.unstable, message.result);
        if (message.duration && (message.slow || message.halfSlow)) {
          const slownessColor = SLOWNESS_COLORS[message.slow ? 'slow' : 'halfSlow'];
          line += slownessColor(' (' + Math.round(message.duration) + 'ms)');
        }
        this._log.replace(pathAsString, line);
      }
    }
  }
}
