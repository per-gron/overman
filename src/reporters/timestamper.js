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

var _ = require('lodash');

/**
 * Timestamper is a reporter mainly for internal use by the suite runner. It
 * forwards all messages to another reporter, but also adds a timestamp as a
 * last argument to the methods.
 *
 * At first, I added the logic for doing this to the suite runner itself, but
 * the code got quite messy so it's extracted to a separate file with this.
 */
function Timestamper(reporter, clock) {
  this._reporter = reporter;
  this._clock = clock;
}

Timestamper.prototype._forwardCall = function (message, args) {
  var reporter = this._reporter;
  if (reporter[message]) {
    reporter[message].apply(reporter, args.concat([this._clock()]));
  }
};

['registrationFailed', 'registerTests', 'gotMessage', 'done'].forEach(function (message) {
  Timestamper.prototype[message] = function () {
    this._forwardCall(message, _.toArray(arguments));
  };
});

module.exports = Timestamper;
