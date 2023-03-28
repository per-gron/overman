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

var expect = require('chai').expect;
var recursive = require('recursive-readdir');

// This doesn't actually test for anything per se. Its purpose is to make sure
// that all source files are required by at least one test, so that the test
// coverage reporting is accurate.
it('should require all files', function (done) {
  recursive(__dirname + '/..', function (err, files) {
    expect(err).to.be.null;
    files
      .filter((file) => file.endsWith('.js'))
      .filter((file) => !file.startsWith(__dirname))
      .filter(function (file) {
        // The scripts can't just be required. They are tested though so it
        // doesn't hurt much.
        return !file.match(/[\/\\]bin[\/\\](list_suite|run_test)\.js/);
      })
      .forEach(function (file) {
        require(file);
      });
    done();
  });
});
