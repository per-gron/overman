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

var streamUtil = require('./util/stream');
var ErrorDetail = require('../lib/reporter/error_detail');
var listSuite = require('../lib/list_suite');

function doWithReporterAndCheck(callback, expectedLines) {
  // We don't care about colors here, since this is a unit test and ErrorDetail
  // itself doesn't do any coloring.
  var stream = streamUtil.stripAnsiStream();

  var promise = streamUtil.waitForStreamToEmitLines(stream, expectedLines);

  var reporter = new ErrorDetail(stream);
  callback(reporter);
  stream.end();

  return promise;
}

describe('Error detail reporter', function() {
  it('should not print anything if no test failed', function() {
    return doWithReporterAndCheck(function(reporter) {
      reporter.done();
    }, []);
  });

  it('should print registrationFailed information', function() {
    return doWithReporterAndCheck(function(reporter) {
      reporter.registrationFailed(new listSuite.ListTestError('Failed to process suite.js', 'blah\nblah'));
    }, [
      /Failed to process suite.js/,
      /blah/,
      /blah/
    ]);
  });

  it('should handle missing result in finish message', function() {
    return doWithReporterAndCheck(function(reporter) {
      reporter.gotMessage({ path: ['test'] }, { type: 'finish' });
      reporter.done();
    }, []);
  });

  it('should number test failures', function() {
    return doWithReporterAndCheck(function(reporter) {
      reporter.gotMessage({ path: ['test1'] }, { type: 'error', value: 'An error' });
      reporter.gotMessage({ path: ['test2'] }, { type: 'error', value: 'An error' });
      reporter.gotMessage({ path: ['test1'] }, { type: 'finish', result: 'failure' });
      reporter.gotMessage({ path: ['test2'] }, { type: 'finish', result: 'failure' });
      reporter.done();
    }, [
      / 1\) /,
      /.*/,
      /.*/,
      / 2\) /,
      /.*/,
      /.*/
    ]);
  });

  it('should report suite as well as test names', function() {
    return doWithReporterAndCheck(function(reporter) {
      reporter.gotMessage({ path: ['suite', 'test1'] }, { type: 'error', value: 'An error' });
      reporter.gotMessage({ path: ['suite', 'test1'] }, { type: 'finish', result: 'failure' });
      reporter.done();
    }, [
      /suite test1:$/,
      /.*/,
      /.*/
    ]);
  });

  it('should report test errors', function() {
    return doWithReporterAndCheck(function(reporter) {
      reporter.gotMessage({ path: ['test1'] }, { type: 'error', value: 'Error: X\n    Trace' });
      reporter.gotMessage({ path: ['test1'] }, { type: 'finish', result: 'failure' });
      reporter.done();
    }, [
      /test1:/,
      '     Error: X',
      '       Trace',
      ''
    ]);
  });

  it('should report tests that time out', function() {
    return doWithReporterAndCheck(function(reporter) {
      reporter.gotMessage({ path: ['test1'] }, { type: 'startedBeforeHook' });
      reporter.gotMessage({ path: ['test1'] }, { type: 'finish', result: 'timeout' });
      reporter.done();
    }, [
      /test1:$/,
      '     In before hook: Timed out',
      ''
    ]);
  });

  it('should not treat successful tests as failures', function() {
    return doWithReporterAndCheck(function(reporter) {
      reporter.gotMessage({ path: ['test1'] }, { type: 'finish', result: 'success' });
      reporter.done();
    }, []);
  });

  it('should not treat skipped tests as failures', function() {
    return doWithReporterAndCheck(function(reporter) {
      reporter.gotMessage({ path: ['test1'] }, { type: 'finish', result: 'skipped' });
      reporter.done();
    }, []);
  });

  it('should not treat aborted tests as failures', function() {
    return doWithReporterAndCheck(function(reporter) {
      reporter.gotMessage({ path: ['test1'] }, { type: 'finish', result: 'aborted' });
      reporter.done();
    }, []);
  });

  it('should report all errors that a test emitted', function() {
    return doWithReporterAndCheck(function(reporter) {
      reporter.gotMessage({ path: ['test1'] }, { type: 'error', value: 'Error: X\n    Trace' });
      reporter.gotMessage({ path: ['test1'] }, { type: 'error', value: 'Error: Y\n    Trace' });
      reporter.gotMessage({ path: ['test1'] }, { type: 'finish', result: 'failure' });
      reporter.done();
    }, [
      /test1:/,
      '     Error: X',
      '       Trace',
      '',
      '     Error: Y',
      '       Trace',
      ''
    ]);
  });
});
