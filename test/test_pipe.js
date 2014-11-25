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

var through = require('through');
var when = require('when');
var Pipe = require('../lib/reporter/pipe');
var suiteRunner = require('../lib/suite_runner');
var streamUtil = require('./util/stream');

function runSuite(suite, reporter) {
  return suiteRunner({
      suites: [__dirname + '/suite/' + suite],
      interface: './lib/interface/bdd_mocha',
      reporters: [reporter]
    });
}

describe('Pipe reporter', function() {
  it('should be capable of being constructed with no streams', function() {
    return runSuite('suite_single_successful_test', new Pipe({}));
  });

  it('should pipe stdout', function() {
    var stream = through();
    var suitePromise = runSuite('suite_single_successful_test', new Pipe({ stdout: stream }));
    return when.all([
      streamUtil.waitForStreamToEmitLines(stream, [
        /running_test/
      ]),
      suitePromise
    ]);
  });

  it('should pipe stderr', function() {
    var stream = through();
    var suitePromise = runSuite('suite_test_that_prints_to_stderr', new Pipe({ stderr: stream }));
    return when.all([
      streamUtil.waitForStreamToEmitLines(stream, [
        /printing_to_stderr/
      ]),
      suitePromise
    ]);
  });
});
