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

var fs = require('fs');
var path = require('path');
var suiterunner = require('./lib/suite_runner');
var ErrorDetailReporter = require('./lib/reporter/error_detail');
var PipeReporter = require('./lib/reporter/pipe');
var SpecProgress = require('./lib/reporter/spec_progress');
var Summary = require('./lib/reporter/summary');
var TestFailureError = require('./lib/test_failure_error');
var errorMessageUtil = require('./lib/error_message_util');

var suiteFiles = fs.readdirSync('test')
  .filter(function(filename) { return filename.match(/^test_/); })
  .map(function(filename) { return path.join('test', filename) });

var suitePromise = suiterunner({
    suites: suiteFiles,
    interface: './lib/interface/bdd_mocha',
    reporters: [
      new PipeReporter(process),
      new SpecProgress(process.stdout),
      new Summary(process.stdout),
      new ErrorDetailReporter(process.stdout)
    ],
    parallelism: 8,
    timeout: 10000
  });

process.on('SIGINT', function() {
  suitePromise.cancel();
});

suitePromise.done(function() {}, function(err) {
  if (!(err instanceof TestFailureError)) {
    // Test failures will already have been reported by reporters, so there
    // is no need for us to report them here.
    console.error('Internal error in Overman or a reporter:');
    console.error(errorMessageUtil.indent(errorMessageUtil.prettyError({
      value: err.stack
    }), 2));
  }
  process.exit(1);
});
