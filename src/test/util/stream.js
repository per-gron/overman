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

'use strict';

var readline = require('readline');
var stripAnsi = require('strip-ansi');
var through = require('through');

function waitForStreamToEmitLines(stream, linesToWatchFor) {
  return new Promise(function (resolve, reject) {
    var lines = readline.createInterface({ input: stream, output: stream });

    lines.on('line', function (line) {
      if (linesToWatchFor.length === 0) {
        reject(new Error('Encountered unexpected line ' + line + ' when expecting no more output'));
      }

      var regex = linesToWatchFor[0];
      if (typeof regex === 'string' ? line === regex : line.match(regex)) {
        linesToWatchFor.shift();
      } else {
        reject(
          new Error('Encountered unexpected line ' + line + ', expected ' + linesToWatchFor[0])
        );
        lines.close();
      }
    });

    lines.on('close', function () {
      if (linesToWatchFor.length === 0) {
        resolve();
      } else {
        reject(new Error('Encountered end of output while still waiting for ' + linesToWatchFor));
      }
    });
  });
}
exports.waitForStreamToEmitLines = waitForStreamToEmitLines;

/**
 * Wait for a single line (ignoring others)
 */
function waitForStreamToEmitLine(stream, lineToWatchFor) {
  return new Promise(function (resolve, reject) {
    var found = false;
    var lines = readline.createInterface({ input: stream, output: stream });

    lines.on('line', function (line) {
      if (found) {
        return;
      }

      if (
        typeof lineToWatchFor === 'string' ? line === lineToWatchFor : line.match(lineToWatchFor)
      ) {
        found = true;
      }
    });

    lines.on('close', function () {
      if (found) {
        resolve();
      } else {
        reject(new Error('Encountered end of output while still waiting for ' + lineToWatchFor));
      }
    });
  });
}
exports.waitForStreamToEmitLine = waitForStreamToEmitLine;

function stripAnsiStream() {
  return through(function (data) {
    this.emit('data', stripAnsi(data));
  });
}
exports.stripAnsiStream = stripAnsiStream;
