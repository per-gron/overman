/*
 * Copyright 2014, 2016 Per Eckerdal
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

import * as readline from 'readline';
import { Readable, Writable } from 'stream';
import stripAnsi = require('strip-ansi');
import * as through from 'through';

export function waitForStreamToEmitLines(
  input: Readable | (Readable & Writable),
  linesToWatchFor: (RegExp | string)[]
) {
  const output = 'write' in input ? input : undefined;
  return new Promise<void>((resolve, reject) => {
    const lines = readline.createInterface({ input, output });

    lines.on('line', (line) => {
      if (linesToWatchFor.length === 0) {
        reject(new Error(`Encountered unexpected line ${line} when expecting no more output`));
      }

      const [regex] = linesToWatchFor;
      if (typeof regex === 'string' ? line === regex : line.match(regex)) {
        linesToWatchFor.shift();
      } else {
        reject(new Error(`Encountered unexpected line ${line}, expected ${regex}`));
        lines.close();
      }
    });

    lines.on('close', () => {
      if (linesToWatchFor.length === 0) {
        resolve();
      } else {
        reject(new Error(`Encountered end of output while still waiting for ${linesToWatchFor}`));
      }
    });
  });
}

/**
 * Wait for a single line (ignoring others)
 */
export function waitForStreamToEmitLine(
  stream: Readable & Writable,
  lineToWatchFor: RegExp | string
) {
  return new Promise<void>((resolve, reject) => {
    let found = false;
    const lines = readline.createInterface({ input: stream, output: stream });

    lines.on('line', (line) => {
      if (found) {
        return;
      }

      if (
        typeof lineToWatchFor === 'string' ? line === lineToWatchFor : line.match(lineToWatchFor)
      ) {
        found = true;
      }
    });

    lines.on('close', () => {
      if (found) {
        resolve();
      } else {
        reject(new Error(`Encountered end of output while still waiting for ${lineToWatchFor}`));
      }
    });
  });
}

export function stripAnsiStream() {
  return through(function (this: through.ThroughStream, data) {
    this.emit('data', stripAnsi(data));
  });
}
