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

var when = require('when');

it('should succeed', function() {
  return when.promise(function(resolve) {
    console.log('running_test');
    process.nextTick(function() {
      // The idea here is that if the test runner respects that we return a
      // promise here, then this should be run before the after hook.
      console.log('still_running_test');
      resolve();
    });
  });
});

after(function() {
  console.log('running_after_hook');
});
