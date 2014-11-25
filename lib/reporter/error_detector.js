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

/**
 * ErrorDetector is a reporter mainly for internal use by the suite
 * runner. It remembers if any of the tests runs failed.
 */
function ErrorDetector() {
  this._didFail = false;
}

ErrorDetector.prototype.gotMessage = function(testPath, message) {
  if (message.type === 'finish' && !message.result.match(/^(success)|(skipped)$/)) {
    this._didFail = true;
  }
};

ErrorDetector.prototype.didFail = function() {
  return this._didFail;
};

module.exports = ErrorDetector;
