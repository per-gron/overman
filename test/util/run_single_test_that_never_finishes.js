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

// This is a script that does things, not just a module. It uses the suite
// runner to run a single test. Its purpose is to validate that nothing is
// leaked on the runloop; the script should exit in a timely manner.

var suiteRunner = require('../../dist/suite_runner');

suiteRunner({
  files: [__dirname + '/../../test/suite/suite_single_test_that_never_finishes'],
  reporters: [],
  timeout: 50000
});
