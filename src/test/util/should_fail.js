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

function shouldFail(promise, errorPredicate) {
  return promise.then(
    function () {
      throw new Error('Should fail');
    },
    function (error) {
      if (errorPredicate && !errorPredicate(error)) {
        throw new Error('Got unexpected error: ' + error);
      }
    }
  );
}
module.exports = shouldFail;
