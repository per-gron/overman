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

import { Writable } from 'stream';
import * as errorMessageUtil from '../error_message_util';
import { TestPath } from '../test_path';
import { BreadcrumbMessage, ErrorMessage, FinishMessage, Message } from './message';
import MessageTracker from './message_tracker';
import PhaseTracker from './phase_tracker';
import Reporter from './reporter';

/**
 * ErrorDetail is a reporter that, when all tests have run, prints the errors
 * that occured. This is typically used together with other reporters for
 * example the SpecProgress reporter and the Summary reporter.
 */
export default class ErrorDetail implements Reporter {
  _failures: { test: TestPath; message: FinishMessage }[] = [];
  _errorTracker = new MessageTracker<ErrorMessage>('error');
  _breadcrumbTracker = new MessageTracker<BreadcrumbMessage>('breadcrumb');
  _phaseTracker = new PhaseTracker();

  constructor(private _stream: Writable) {}

  registrationFailed(error: Partial<ErrorMessage>) {
    this._stream.write(errorMessageUtil.prettyError(error));
  }

  gotMessage(testPath: TestPath, message: Message) {
    this._phaseTracker.gotMessage(testPath, message);
    this._errorTracker.gotMessage(testPath, message);
    this._breadcrumbTracker.gotMessage(testPath, message);

    if (
      message.type === 'finish' &&
      message.result &&
      !message.result.match(/^(success)|(skipped)|(aborted)$/)
    ) {
      this._failures.push({
        test: testPath,
        message: message,
      });
    }
  }

  done() {
    this._failures.forEach((failure, idx) => {
      const errorNumber = idx + 1;
      this._stream.write('  ' + errorNumber + ') ' + failure.test.path.join(' ') + ':\n');
      const indentation = errorNumber.toString().length + 4;

      const errors = this._errorTracker.getMessages(failure.test);
      errors.forEach((error) =>
        this._stream.write(
          errorMessageUtil.indent(errorMessageUtil.prettyError(error), indentation) + '\n'
        )
      );

      if (failure.message.result === 'timeout') {
        const lastPhase = this._phaseTracker.getLastPhase(failure.test);
        this._stream.write(
          errorMessageUtil.indent(errorMessageUtil.prettyTimeout(lastPhase), indentation)
        );
        this._stream.write('\n');
      }

      // Only show breadcrumbs for tests that time out or that fail with an
      // uncaught exception. This is done because timeouts and uncaught exceptions
      // are always the last thing to happen in a test. "Normal" errors will still
      // make after hooks and so on to run, and in that case it's quite confusing
      // to show the last breadcrumb of a test. That breadcrumb is likely
      // something that happened *after* the error that caused the test to fail.
      const shouldShowBreadcrumb =
        failure.message.result === 'timeout' ||
        (errors.length !== 0 && errors.at(-1)?.in === 'uncaught');

      const breadcrumb = this._breadcrumbTracker.getMessages(failure.test).at(-1);
      if (breadcrumb && shouldShowBreadcrumb) {
        const breadcrumbString = errorMessageUtil.prettyBreadcrumb(breadcrumb, 'Last breadcrumb');
        this._stream.write(errorMessageUtil.indent(breadcrumbString, indentation));
        this._stream.write('\n');
      }
    });
  }
}
