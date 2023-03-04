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
import { expect } from 'chai';
import { Stream, Writable } from 'stream';
import * as through from 'through';
import InsertionLog from '../insertion_log';

function readEntireStream(stream: Stream) {
  return new Promise((resolve) => {
    let data = '';
    stream.on('data', (chunk) => (data += chunk));
    stream.on('close', () => resolve(data));
  });
}

async function expectWithLog(loggingFn: (_: InsertionLog) => void, expectedLines: string[]) {
  const stream: Writable = through();
  const promise = readEntireStream(stream);

  loggingFn(new InsertionLog(stream));
  stream.end();

  const data = await promise;
  expect(data).to.be.equal(expectedLines.join('\n') + '\n');
}

const clearLine = '\u001b[2K' + '\u001b[0G';

function cursorUp(n: number) {
  return n > 0 ? `\u001b[${n}A` : '';
}

describe('Insertion log', function () {
  describe('.log', function () {
    it('should append first log line', function () {
      return expectWithLog((log) => log.log('A line'), [`${clearLine}A line`]);
    });

    it('should append log lines to the end', function () {
      return expectWithLog(
        (log) => {
          log.log('A line');
          log.log('Another line');
        },
        [clearLine + 'A line', clearLine + 'Another line']
      );
    });
  });

  describe('.logAfter', function () {
    it('should insert log line after last line', function () {
      return expectWithLog(
        (log) => {
          log.log('A line', 'lid1');
          log.log('A second line', 'lid2');
          log.logAfter('lid2', 'Another line');
        },
        [clearLine + 'A line', clearLine + 'A second line', clearLine + 'Another line']
      );
    });

    it('should insert log line after the first line', function () {
      return expectWithLog(
        (log) => {
          log.log('A line', 'lid1');
          log.log('A second line', 'lid2');
          log.logAfter('lid1', 'Another line');
        },
        [
          clearLine + 'A line',
          clearLine + 'A second line',
          cursorUp(1) + clearLine + 'Another line',
          clearLine + 'A second line',
        ]
      );
    });

    it('should insert log line after the last line with the given id', function () {
      return expectWithLog(
        (log) => {
          log.log('A line', 'lid');
          log.log('A second line', 'lid');
          log.logAfter('lid', 'Another line');
        },
        [clearLine + 'A line', clearLine + 'A second line', clearLine + 'Another line']
      );
    });

    it('should not insert log line after nonexistent line', function () {
      const log = new InsertionLog(through());
      expect(() => log.logAfter('nonexistent', 'Hey!')).to.throw(/No message found/);
    });
  });

  describe('.logBefore', function () {
    it('should insert log line before the last line', function () {
      return expectWithLog(
        (log) => {
          log.log('A line', 'lid1');
          log.log('A second line', 'lid2');
          log.logBefore('lid2', 'Another line');
        },
        [
          clearLine + 'A line',
          clearLine + 'A second line',
          cursorUp(1) + clearLine + 'Another line',
          clearLine + 'A second line',
        ]
      );
    });

    it('should insert log line before the first line', function () {
      return expectWithLog(
        (log) => {
          log.log('A line', 'lid1');
          log.log('A second line', 'lid2');
          log.logBefore('lid1', 'Another line');
        },
        [
          clearLine + 'A line',
          clearLine + 'A second line',
          cursorUp(2) + clearLine + 'Another line',
          clearLine + 'A line',
          clearLine + 'A second line',
        ]
      );
    });

    it('should insert log line before the last line with the given id', function () {
      return expectWithLog(
        (log) => {
          log.log('A line', 'lid');
          log.log('A second line', 'lid');
          log.logBefore('lid', 'Another line');
        },
        [
          clearLine + 'A line',
          clearLine + 'A second line',
          cursorUp(1) + clearLine + 'Another line',
          clearLine + 'A second line',
        ]
      );
    });

    it('should not insert log line before nonexistent line', function () {
      const log = new InsertionLog(through());
      expect(() => log.logBefore('nonexistent', 'Hey!')).to.throw(/No message found/);
    });
  });

  describe('.replace', function () {
    it('should replace appended log line', function () {
      return expectWithLog(
        (log) => {
          log.log('A line', 'lid');
          log.replace('lid', 'Another line');
        },
        [clearLine + 'A line', cursorUp(1) + clearLine + 'Another line']
      );
    });

    it('should replace logAfter line', function () {
      return expectWithLog(
        (log) => {
          log.log('A line', 'lid1');
          log.logAfter('lid1', 'A second line', 'lid2');
          log.replace('lid2', 'Another line');
        },
        [
          clearLine + 'A line',
          clearLine + 'A second line',
          cursorUp(1) + clearLine + 'Another line',
        ]
      );
    });

    it('should replace logBefore line', function () {
      return expectWithLog(
        (log) => {
          log.log('A line', 'lid1');
          log.logBefore('lid1', 'A second line', 'lid2');
          log.replace('lid2', 'Another line');
        },
        [
          clearLine + 'A line',
          cursorUp(1) + clearLine + 'A second line',
          clearLine + 'A line',
          cursorUp(2) + clearLine + 'Another line',
          clearLine + 'A line',
        ]
      );
    });

    it('should replace the last printed line with the given id', function () {
      return expectWithLog(
        (log) => {
          log.log('A line', 'lid');
          log.log('A second line', 'lid');
          log.replace('lid', 'Another line');
        },
        [
          clearLine + 'A line',
          clearLine + 'A second line',
          cursorUp(1) + clearLine + 'Another line',
        ]
      );
    });

    it('should not replace nonexistent line', function () {
      const log = new InsertionLog(through());
      expect(() => log.replace('nonexistent', 'Hey!')).to.throw(/No message found/);
    });

    it('should replace appropriately when replaced message is more than one line', function () {
      return expectWithLog(
        (log) => {
          log.log('A line', 'lid1');
          log.log('A second line', 'lid2');
          log.replace('lid1', 'A\nline');
        },
        [
          clearLine + 'A line',
          clearLine + 'A second line',
          cursorUp(2) + clearLine + 'A',
          clearLine + 'line',
          clearLine + 'A second line',
        ]
      );
    });

    it('should replace appropriately when replaced message is empty', function () {
      return expectWithLog(
        (log) => {
          log.log('', 'lid1');
          log.log('A second line', 'lid2');
          log.replace('lid1', 'A line');
        },
        [
          clearLine + '',
          clearLine + 'A second line',
          cursorUp(2) + clearLine + 'A line',
          clearLine + 'A second line',
        ]
      );
    });
  });

  it('should handle TTY newlines appropriately');
});
