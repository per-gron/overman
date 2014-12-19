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
 * Pipe is a reporter that pipes the streams of the test to somewhere else,
 * typically stdio (for that, you can simply pass in process to the
 * constructor).
 *
 * This may seem like a stupid and trivial thing, but this is actually a quite
 * important reporter in Overman: Without it, output form tests will be
 * swallowed.
 *
 * @param streams. Of format { stdout: [stream], stderr: [stream] }.
 *     Streams itself is required, but all streams are optional.
 */
function Pipe(streams) {
  this._streams = streams;
}

Pipe.prototype.gotMessage = function(testPath, message) {
  var self = this;

  if (message.type === 'stdio') {
    ['stdout', 'stderr'].forEach(function(streamName) {
      if (self._streams[streamName] && message[streamName]) {
        message[streamName].pipe(self._streams[streamName]);
      }
    });
  }
};

module.exports = Pipe;
