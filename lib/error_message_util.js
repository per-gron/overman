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

var chalk = require('chalk');

var errorLocations = {
  afterHook: 'after hook',
  beforeHook: 'before hook'
};

var colors = {
  errorPlace: chalk.cyan,
  errorHeader: chalk.red,
  trace: chalk.grey
};

/**
 * Generates a (non-colored) human-readable string of where an error occured.
 * The input format is designed so that you can simply pass in a message of type
 * 'error' that was passed to a reporter.
 *
 * @param errorMessage Object of the form
 *     { in: 'test|beforeHook|afterHook|uncaught', [inName: 'name'] }
 */
function prettyErrorLocation(errorMessage) {
  if (!errorMessage) {
    return 'Unknown location';
  } else if (errorMessage.in === 'uncaught') {
    return 'Uncaught error';
  }

  var placeType = errorLocations[errorMessage.in] || errorMessage.in;
  var placeName = errorMessage.inName ? (' "' + errorMessage.inName + '"') : '';
  return 'In ' + placeType + placeName;
}
exports.prettyErrorLocation = prettyErrorLocation;

/**
 * Generates a colored, non-indented, human readable description of a single
 * error, in the format it is given to reporters as a message of type 'error'.
 *
 * @param errorMessage The error message, as given to the reporter:
 *     {
 *       [in: test|beforeHook|afterHook]
 *       value: [error.stack]
 *     }
 */
function prettyError(errorMessage) {
  if (!errorMessage) {
    return '[No error]';
  }

  var result = '';

  var errorLines = (errorMessage.value || '').split('\n');

  if (errorMessage.in) {
    result += colors.errorPlace(prettyErrorLocation(errorMessage) + ':') + ' ';
  }
  result += colors.errorHeader(errorLines[0]) + '\n';
  errorLines.splice(1).forEach(function(line) {
    result += colors.trace(line.replace(/^  /, '')) + '\n';
  });

  return result;
}
exports.prettyError = prettyError;

/**
 * Generates a colored, non-indented, human readable description of a test
 * timeout, including when it happened.
 *
 * @param location Information about what part of the test timed out.
 *     The object should be of the form that prettyErrorLocation expects.
 */
function prettyTimeout(location) {
  return (colors.errorPlace(prettyErrorLocation(location) + ':') + ' ' +
          colors.errorHeader('Timed out') + '\n');
}
exports.prettyTimeout = prettyTimeout;

function multiplyString(str, num) {
  if (num <= 0 || typeof num !== 'number') {
    return '';
  } else {
    return str + multiplyString(str, num - 1);
  }
}

function spaces(num) {
  return multiplyString(' ', num);
}

/**
 * Takes a string (possibly with newlines in it) and indents it with a given
 * number of spaces. Blank lines (for example the last line after an ending
 * newline) are not indented.
 *
 * @param str The string to indent
 * @param num The number of spaces to indent with
 */
function indent(str, num) {
  var space = spaces(num);
  return str.split('\n').map(function(line) {
    if (line.match(/^\s*$/)) {
      return line;
    } else {
      return space + line;
    }
  }).join('\n');
}
exports.indent = indent;

/**
 * PhaseTracker is a very basic reporter (in the sense that it conforms to the
 * reporter interface) that does nothing but keep track of where a test was
 * last (ie which hook it was in or if it was in the test).
 *
 * It doesn't actually report anything anywhere but it exposes an accessor for
 * getting the last phase of a test.
 *
 * This is useful when showing error messages for tests that time out: It is
 * helpful to say what timed out.
 */
function PhaseTracker() {
  this._lastPhase = {};  // Hash of JSON'd testPath to { in: '', inName: '' }
}
exports.PhaseTracker = PhaseTracker;

PhaseTracker.prototype.gotMessage = function(testPath, message) {
  var key = JSON.stringify(testPath);

  if (message.type === 'startedBeforeHook') {
    this._lastPhase[key] = { in: 'beforeHook', inName: message.name };
  } else if (message.type === 'startedTest') {
    this._lastPhase[key] = { in: 'test' };
  } else if (message.type === 'startedAfterHook') {
    this._lastPhase[key] = { in: 'afterHook', inName: message.name };
  } else if (message.type === 'retry') {
    delete this._lastPhase[key];
  }
};

PhaseTracker.prototype.getLastPhase = function(path) {
  return this._lastPhase[JSON.stringify(path)];
};

function testPathToKey(testPath) {
  return JSON.stringify(testPath);
}

/**
 * ErrorTracker is a very basic reporter (in the sense that it conforms to the
 * reporter interface) that does nothing but keep track of errors that tests
 * emit.
 *
 * It doesn't actually report anything anywhere but it exposes an accessor for
 * getting the errors that a test has emitted so far.
 *
 * This is useful when showing errors for tests not immediately when the error
 * occured.
 */
function ErrorTracker() {
  this._errors = {};  // Hash of JSON'd testPath to array of error messages
}
exports.ErrorTracker = ErrorTracker;

ErrorTracker.prototype.getErrors = function(testPath) {
  var key = testPathToKey(testPath);
  return this._errors[key] || [];
};

ErrorTracker.prototype._addError = function(testPath, message) {
  var key = testPathToKey(testPath);
  this._errors[key] = this.getErrors(testPath).concat([message]);
};

ErrorTracker.prototype.gotMessage = function(testPath, message) {
  if (message.type === 'error') {
    this._addError(testPath, message);
  } else if (message.type === 'retry') {
    this._errors[testPathToKey(testPath)] = [];
  }
};
