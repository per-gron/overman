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

var fs = require('fs');
var path = require('path');
var overman = require('./lib/overman');

var suiteFiles = fs.readdirSync('test')
  .filter(function(filename) { return filename.match(/^test_/); })
  .map(function(filename) { return path.join('test', filename) });

var suitePromise = overman({ files: suiteFiles });

var finished = false;
suitePromise.finally(function() {
  finished = true;
});

process.on('SIGINT', function() {
  if (finished) {
    // It is possible that the test suite has finished running, but that
    // something is still left on the runloop. In that case, we shoulnd't
    // prevent the user from shutting down the process.
    process.exit(1);
  } else {
    suitePromise.cancel();
  }
});

suitePromise.done(function() {}, function(err) {
  process.exit(1);
});
