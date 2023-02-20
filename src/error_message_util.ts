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
import {
  BreadcrumbMessage,
  ErrorMessage,
  HookErrorMessage,
  TestErrorMessage,
} from './reporters/message';

const ERROR_LOCATIONS: Record<string, string | undefined> = {
  afterHook: 'after hook',
  beforeHook: 'before hook',
};

const COLORS = {
  errorPlace: chalk.cyan,
  errorHeader: chalk.red,
  trace: chalk.grey,
};

export type ErrorLocation = Pick<TestErrorMessage, 'in'> | Pick<HookErrorMessage, 'in' | 'inName'>;

/**
 * Generates a (non-colored) human-readable string of where an error occured.
 * The input format is designed so that you can simply pass in a message of type
 * 'error' that was passed to a reporter.
 */
export function prettyErrorLocation(errLoc?: ErrorLocation) {
  if (!errLoc) {
    return 'Unknown location';
  } else if (errLoc.in === 'uncaught') {
    return 'Uncaught error';
  }

  const placeType = ERROR_LOCATIONS[errLoc.in] ?? errLoc.in;
  const placeName = 'inName' in errLoc && errLoc.inName ? ` "${errLoc.inName}"` : '';
  return `In ${placeType}${placeName}`;
}

function dedentTraceLine(line: string) {
  return line.replace(/^  /, '');
}

/**
 * Generates a colored, non-indented, human readable description of a single
 * error, in the format it is given to reporters as a message of type 'error'.
 *
 * @param errorMessage The error message, as given to the reporter:
 *     {
 *       [in: test|beforeHook|afterHook|uncaught]
 *       stack: [error.stack]
 *     }
 */
export function prettyError(errorMessage?: Partial<ErrorMessage>) {
  if (!errorMessage) {
    return '[No error]';
  }

  let result = '';

  const errorLines = errorMessage.stack ? errorMessage.stack.split('\n') : [];

  if (errorMessage.in) {
    result += COLORS.errorPlace(`${prettyErrorLocation(errorMessage as ErrorMessage)}:`) + ' ';
  }
  result += COLORS.errorHeader(errorLines[0]) + '\n';

  return errorLines
    .slice(1)
    .map(dedentTraceLine)
    .reduce((result, line) => result + COLORS.trace(line) + '\n', result);
}

/**
 * Generates a colored, non-indented, human readable description of a test
 * timeout, including when it happened.
 *
 * @param location Information about what part of the test timed out.
 *     The object should be of the form that prettyErrorLocation expects.
 */
export function prettyTimeout(errLoc?: ErrorLocation) {
  return (
    COLORS.errorPlace(`${prettyErrorLocation(errLoc)}:`) +
    ' ' +
    COLORS.errorHeader('Timed out') +
    '\n'
  );
}

export function prettyBreadcrumb(breadcrumb: BreadcrumbMessage, place?: string) {
  const result = `${(place ? COLORS.errorPlace(`${place}: `) : '') + breadcrumb.message}\n`;

  if (breadcrumb.trace) {
    return breadcrumb.trace
      .split(/\n/)
      .map(dedentTraceLine)
      .reduce((result, line) => result + COLORS.trace(line) + '\n', result);
  }

  return result;
}

function multiplyString(str: string, num?: number): string {
  return typeof num === 'number' && num > 0 ? str + multiplyString(str, num - 1) : '';
}

function spaces(num?: number) {
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
export function indent(str: string, num?: number) {
  const space = spaces(num);
  return str
    .split('\n')
    .map((line) => (line.match(/^\s*$/) ? line : space + line))
    .join('\n');
}
