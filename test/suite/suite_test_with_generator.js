/*
 * Copyright 2015-2016 Per Eckerdal
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

it('should succeed', function() {
  // Simulate a generator without actually using the syntax, for node 0.10 compatibility
  var state = 0;
  return {
    next: function(value) {
      state++;
      if (state === 1) {
        console.log('running_test');
        return { value: Promise.resolve('running_test'), done: false };
      } else if (state === 2) {
        console.log('still_' + value);
        return { value: undefined, done: true };
      }
      return { done: true };
    }
  };
});

after(function() {
  console.log('running_after_hook');
});
