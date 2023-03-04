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
 * Combined is a reporter mainly for internal use by the suite
 * runner. It forwards all messages to other reporters.
 */
function Combined(reporters) {
  this._reporters = reporters;
}

Combined.prototype._forwardCall = function (message, args) {
  this._reporters.forEach(function (reporter) {
    if (reporter[message]) {
      reporter[message].apply(reporter, args);
    }
  });
};

['registrationFailed', 'registerTests', 'gotMessage', 'done'].forEach(function (message) {
  Combined.prototype[message] = function () {
    this._forwardCall(message, arguments);
  };
});

module.exports = Combined;
