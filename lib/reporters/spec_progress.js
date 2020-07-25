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

'use strict';

var _ = require('lodash');
var chalk = require('chalk');
var readline = require('readline');
var through = require('through');
var InsertionLog = require('../insertion_log');
var testPathUtil = require('../test_path_util');

function nSpaces(n) {
  return n === 0 ? '' : ' ' + nSpaces(n - 1);
}

function spacesForPath(path) {
  return nSpaces(path.path.length * 2);
}

var symbols = {
  inProgress: ' ',
  success: '✓',
  failure: '✖',
  timeout: '⧖',
  skipped: '-',
  aborted: '-'
};

var symbolColors = {
  inProgress: chalk.grey,
  success: chalk.green,
  failure: chalk.red,
  timeout: chalk.red,
  skipped: chalk.cyan,
  aborted: chalk.yellow
};

var nameColors = {
  skipped: chalk.cyan,
  failure: chalk.red,
  timeout: chalk.red,
  aborted: chalk.yellow,
  defaultColor: chalk.grey
};

var slownessColors = {
  slow: chalk.red,
  halfSlow: chalk.yellow
};

function color(palette, name) {
  return palette[name] || palette.defaultColor || function(x) { return x; };
}

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
function SpecProgress(streams, insertionLog) {
  /* jshint -W056 */
  this._log = new (insertionLog || InsertionLog)((streams || {}).stdout);
  /* jshint +W056 */

  // The reporter needs to be able to insert new lines for tests and place
  // them where they belong. This is done by keeping track of ids for the
  // last line that was inserted for each test suite.
  this._lastLineIdForSuite = {};

  // Key is test path, value is stream that can be written to for that test
  this._stdout = {};
  // Key is test path, value is stream that can be written to for that test
  this._stderr = {};
}

SpecProgress.prototype._makePipedStream = function(id) {
  var self = this;

  var streamToWriteTo = through();
  var lines = readline.createInterface({
    input: streamToWriteTo,
    output: through()
  });

  function idForCounter(counter) {
    return id + (counter ? '_' + counter : '');
  }

  var counter = 0;

  lines.on('line', function(line) {
    self._log.logAfter(idForCounter(counter), line, idForCounter(counter + 1));
    counter++;
  });

  return streamToWriteTo;
};

SpecProgress.prototype.gotMessage = function(testPath, message) {
  var pathAsString = JSON.stringify(testPath);

  if (message.type === 'suiteStart') {
    var suitePath = message.suite;
    var suitePathString = JSON.stringify(suitePath);
    var suiteName = _.last(suitePath.path) || '';

    this._log.log(spacesForPath(suitePath) + suiteName, suitePathString);
    this._lastLineIdForSuite[suitePathString] = suitePathString;
  } else if (message.type === 'stdout') {
    this._stdout[pathAsString].write(message.data);
  } else if (message.type === 'stderr') {
    this._stderr[pathAsString].write(message.data);
  } else if (message.type === 'start' || message.type === 'finish') {
    var suitePathAsString = JSON.stringify(testPathUtil.suitePathOf(testPath));
    var prefixSpace = spacesForPath(testPath);
    var name = _.last(testPath.path) + (message.unstable ? ' [unstable]' : '');

    var status = message.type === 'start' ? 'inProgress' : message.result;
    var symbolColor = color(symbolColors, status);
    var nameColor = color(nameColors, status);
    var sign = symbols[status] || '?';
    var line = prefixSpace + symbolColor(sign) + ' ' + nameColor(name);

    if (message.type === 'start') {
      this._log.logAfter(this._lastLineIdForSuite[suitePathAsString], line, pathAsString);
      this._lastLineIdForSuite[suitePathAsString] = pathAsString;

      this._stdout[pathAsString] = this._makePipedStream(pathAsString);
      this._stderr[pathAsString] = this._makePipedStream(pathAsString);
    } else if (message.type === 'finish') {
      if (message.duration && (message.slow || message.halfSlow)) {
        var slownessColor = slownessColors[message.slow ? 'slow' : 'halfSlow'];
        line += slownessColor(' (' + Math.round(message.duration) + 'ms)');
      }
      this._log.replace(pathAsString, line);
    }
  }
};

module.exports = SpecProgress;
