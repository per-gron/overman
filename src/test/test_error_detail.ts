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

import * as streamUtil from './util/stream';
import ErrorDetail from '../reporters/error_detail';
import { ListTestError } from '../list_suite';
import { FinishMessage } from '../reporters/message';

function doWithReporterAndCheck(
  callback: (_: ErrorDetail) => void,
  expectedLines: (string | RegExp)[]
) {
  // We don't care about colors here, since this is a unit test and ErrorDetail
  // itself doesn't do any coloring.
  const stream = streamUtil.stripAnsiStream();

  const promise = streamUtil.waitForStreamToEmitLines(stream, expectedLines);

  const reporter = new ErrorDetail(stream);
  callback(reporter);
  stream.end();

  return promise;
}

describe('Error detail reporter', function () {
  it('should not print anything if no test failed', function () {
    return doWithReporterAndCheck((reporter) => reporter.done(), []);
  });

  it('should print registrationFailed information', function () {
    return doWithReporterAndCheck(
      (reporter) =>
        reporter.registrationFailed(new ListTestError('Failed to process suite.js', 'blah\nblah')),
      [/Failed to process suite.js/, /blah/, /blah/]
    );
  });

  it('should handle missing result in finish message', function () {
    return doWithReporterAndCheck((reporter) => {
      reporter.gotMessage({ file: '', path: ['test'] }, { type: 'finish' } as FinishMessage);
      reporter.done();
    }, []);
  });

  it('should number test failures', function () {
    return doWithReporterAndCheck(
      (reporter) => {
        reporter.gotMessage(
          { file: '', path: ['test1'] },
          { type: 'error', stack: 'An error', in: 'test' }
        );
        reporter.gotMessage(
          { file: '', path: ['test2'] },
          { type: 'error', stack: 'An error', in: 'test' }
        );
        reporter.gotMessage(
          { file: '', path: ['test1'] },
          { type: 'finish', result: 'failure', unstable: false }
        );
        reporter.gotMessage(
          { file: '', path: ['test2'] },
          { type: 'finish', result: 'failure', unstable: false }
        );
        reporter.done();
      },
      [/ 1\) /, /.*/, /.*/, / 2\) /, /.*/, /.*/]
    );
  });

  it('should report suite as well as test names', function () {
    return doWithReporterAndCheck(
      (reporter) => {
        reporter.gotMessage(
          { file: '', path: ['suite', 'test1'] },
          { type: 'error', stack: 'An error', in: 'test' }
        );
        reporter.gotMessage(
          { file: '', path: ['suite', 'test1'] },
          { type: 'finish', result: 'failure', unstable: false }
        );
        reporter.done();
      },
      [/suite test1:$/, /.*/, /.*/]
    );
  });

  it('should report test errors', function () {
    return doWithReporterAndCheck(
      (reporter) => {
        reporter.gotMessage(
          { file: '', path: ['test1'] },
          { type: 'error', stack: 'Error: X\n    Trace', in: 'test' }
        );
        reporter.gotMessage(
          { file: '', path: ['test1'] },
          { type: 'finish', result: 'failure', unstable: false }
        );
        reporter.done();
      },
      [/test1:/, '     In test: Error: X', '       Trace', '']
    );
  });

  it('should report tests that time out', function () {
    return doWithReporterAndCheck(
      (reporter) => {
        reporter.gotMessage({ file: '', path: ['test1'] }, { type: 'startedBeforeHook', name: '' });
        reporter.gotMessage(
          { file: '', path: ['test1'] },
          { type: 'finish', result: 'timeout', unstable: false }
        );
        reporter.done();
      },
      [/test1:$/, '     In before hook: Timed out', '']
    );
  });

  it('should report timeouts after test errors', function () {
    return doWithReporterAndCheck(
      (reporter) => {
        reporter.gotMessage({ file: '', path: ['test1'] }, { type: 'startedBeforeHook', name: '' });
        reporter.gotMessage(
          { file: '', path: ['test1'] },
          { type: 'error', stack: 'Error: X\n    Trace', in: 'test' }
        );
        reporter.gotMessage(
          { file: '', path: ['test1'] },
          { type: 'finish', result: 'timeout', unstable: false }
        );
        reporter.done();
      },
      [
        /test1:$/,
        '     In test: Error: X',
        '       Trace',
        '',
        '     In before hook: Timed out',
        '',
      ]
    );
  });

  it('should report the last breadcrumb before timeout for tests that time out', function () {
    return doWithReporterAndCheck(
      (reporter) => {
        reporter.gotMessage({ file: '', path: ['test1'] }, { type: 'startedBeforeHook', name: '' });
        reporter.gotMessage(
          { file: '', path: ['test1'] },
          { type: 'breadcrumb', message: 'other_breadcrumb_msg', trace: 'trace' }
        );
        reporter.gotMessage(
          { file: '', path: ['test1'] },
          { type: 'breadcrumb', message: 'breadcrumb_msg', trace: 'trace' }
        );
        reporter.gotMessage({ file: '', path: ['test1'] }, { type: 'timeout' });
        reporter.gotMessage(
          { file: '', path: ['test1'] },
          { type: 'breadcrumb', message: 'yet_another_breadcrumb_msg', trace: 'trace' }
        );
        reporter.gotMessage(
          { file: '', path: ['test1'] },
          { type: 'finish', result: 'timeout', unstable: false }
        );
        reporter.done();
      },
      [
        /test1:$/,
        '     In before hook: Timed out',
        '',
        '     Last breadcrumb: breadcrumb_msg',
        '     trace',
        '',
      ]
    );
  });

  it('should report the last breadcrumb for tests that fail with an uncaught exception', function () {
    return doWithReporterAndCheck(
      (reporter) => {
        reporter.gotMessage({ file: '', path: ['test1'] }, { type: 'startedBeforeHook', name: '' });
        reporter.gotMessage(
          { file: '', path: ['test1'] },
          { type: 'breadcrumb', message: 'other_breadcrumb_msg', trace: 'trace' }
        );
        reporter.gotMessage(
          { file: '', path: ['test1'] },
          { type: 'breadcrumb', message: 'breadcrumb_msg', trace: 'trace' }
        );
        reporter.gotMessage(
          { file: '', path: ['test1'] },
          { type: 'error', in: 'uncaught', stack: 'Message\nstack' }
        );
        reporter.gotMessage(
          { file: '', path: ['test1'] },
          { type: 'finish', result: 'failure', unstable: false }
        );
        reporter.done();
      },
      [
        /test1:$/,
        '     Uncaught error: Message',
        '     stack',
        '',
        '     Last breadcrumb: breadcrumb_msg',
        '     trace',
        '',
      ]
    );
  });

  it('should not report breadcrumb for tests that fail with an normal error', function () {
    return doWithReporterAndCheck(
      (reporter) => {
        reporter.gotMessage({ file: '', path: ['test1'] }, { type: 'startedBeforeHook', name: '' });
        reporter.gotMessage(
          { file: '', path: ['test1'] },
          { type: 'breadcrumb', message: 'breadcrumb_msg', trace: 'trace' }
        );
        reporter.gotMessage(
          { file: '', path: ['test1'] },
          { type: 'error', in: 'test', stack: 'Message\nstack' }
        );
        reporter.gotMessage(
          { file: '', path: ['test1'] },
          { type: 'finish', result: 'failure', unstable: false }
        );
        reporter.done();
      },
      [/test1:$/, '     In test: Message', '     stack', '']
    );
  });

  it('should not treat successful tests as failures', function () {
    return doWithReporterAndCheck((reporter) => {
      reporter.gotMessage(
        { file: '', path: ['test1'] },
        { type: 'finish', result: 'success', unstable: false }
      );
      reporter.done();
    }, []);
  });

  it('should not treat skipped tests as failures', function () {
    return doWithReporterAndCheck((reporter) => {
      reporter.gotMessage(
        { file: '', path: ['test1'] },
        { type: 'finish', result: 'skipped', unstable: false }
      );
      reporter.done();
    }, []);
  });

  it('should not treat aborted tests as failures', function () {
    return doWithReporterAndCheck((reporter) => {
      reporter.gotMessage(
        { file: '', path: ['test1'] },
        { type: 'finish', result: 'aborted', unstable: false }
      );
      reporter.done();
    }, []);
  });

  it('should report all errors that a test emitted', function () {
    return doWithReporterAndCheck(
      (reporter) => {
        reporter.gotMessage(
          { file: '', path: ['test1'] },
          { type: 'error', stack: 'Error: X\n    Trace', in: 'test' }
        );
        reporter.gotMessage(
          { file: '', path: ['test1'] },
          { type: 'error', stack: 'Error: Y\n    Trace', in: 'test' }
        );
        reporter.gotMessage(
          { file: '', path: ['test1'] },
          { type: 'finish', result: 'failure', unstable: false }
        );
        reporter.done();
      },
      [
        /test1:/,
        '     In test: Error: X',
        '       Trace',
        '',
        '     In test: Error: Y',
        '       Trace',
        '',
      ]
    );
  });
});
