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

// This code is a bit weird. It is designed to detect if the test runner invokes
// the after hooks both when a test times out and when a test finishes. It
// shouldn't do that: The after hooks must be invoked only once per test, even
// when the test finishes while the after hooks are running because the test
// timed out.

let afterHookCallback;
const afterHookPromise = new Promise(resolve => (afterHookCallback = resolve));

it('should be run', function() {
  console.log('in_test');
  return afterHookPromise;
});

after('should be run only once', function() {
  console.log('in_after_hook');
  afterHookCallback();
});
