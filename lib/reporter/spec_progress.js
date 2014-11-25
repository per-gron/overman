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
  skipped: '-'
}

var symbolColors = {
  inProgress: chalk.grey,
  success: chalk.green,
  failure: chalk.red,
  timeout: chalk.red,
  skipped: chalk.cyan
}

var nameColors = {
  skipped: chalk.cyan,
  failure: chalk.red,
  timeout: chalk.red,
  defaultColor: chalk.grey
}

function color(palette, name) {
  return palette[name] || palette.defaultColor || function(x) { return x; };
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
function SpecProgress(stream) {
  this._log = new InsertionLog(stream);

  // The reporter needs to be able to insert new lines for tests and place
  // them where they belong. This is done by keeping track of ids for the
  // last line that was inserted for each test suite.
  this._lastLineIdForSuite = {};
}

SpecProgress.prototype._notYetSeenSuitePaths = function(suitePath) {
  if (suitePath.path.length === 0) {
    return [];
  }

  var suiteString = JSON.stringify(suitePath);
  var notYetSeenParentSuitePaths = this._notYetSeenSuitePaths(testPathUtil.suitePathOf(suitePath));

  if (!(suiteString in this._lastLineIdForSuite)) {
    return notYetSeenParentSuitePaths.concat([suitePath]);
  } else {
    return notYetSeenParentSuitePaths;
  }
};

SpecProgress.prototype._printNotYetSeenSuiteNames = function(testPath) {
  var self = this;
  var notYetSeenSuitePaths = this._notYetSeenSuitePaths(testPathUtil.suitePathOf(testPath));
  notYetSeenSuitePaths.forEach(function(suitePath) {
    var extraNewline = suitePath.path.length === 1 ? '\n' : '';
    var suitePathString = JSON.stringify(suitePath);
    var name = _.last(suitePath.path);
    self._log.log(extraNewline + spacesForPath(suitePath) + name, suitePathString);
    self._lastLineIdForSuite[suitePathString] = suitePathString;
  });
};

SpecProgress.prototype.gotMessage = function(testPath, message) {
  if (message.type !== 'begin' && message.type !== 'finish') {
    return;
  }

  var pathAsString = JSON.stringify(testPath);
  var suitePathAsString = JSON.stringify(testPathUtil.suitePathOf(testPath));
  var prefixSpace = spacesForPath(testPath);
  var name = _.last(testPath.path);

  var status = message.type === 'begin' ? 'inProgress' : message.result;
  var symbolColor = color(symbolColors, status);
  var nameColor = color(nameColors, status);
  var sign = symbols[status] || '?';
  var line = prefixSpace + symbolColor(sign) + ' ' + nameColor(name);

  this._printNotYetSeenSuiteNames(testPath);
  if (message.type === 'begin') {
    this._log.logAfter(this._lastLineIdForSuite[suitePathAsString], line, pathAsString);
    this._lastLineIdForSuite[suitePathAsString] = pathAsString;
  } else if (message.type === 'finish') {
    this._log.replace(pathAsString, line);
  }
};

module.exports = SpecProgress;
