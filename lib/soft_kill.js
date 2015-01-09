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

var TimeoutTimer = require('./timeout_timer');

/**
 * Sends a SIGINT to a process. If it is still not dead after a short while, it
 * sends SIGKILL.
 */
function softKill(process, timeout, timeoutTimer) {
  if (timeout === 0) {
    process.kill('SIGKILL');
  } else {
    /* jshint -W056 */
    var timer = new (timeoutTimer || TimeoutTimer)(timeout);
    /* jshint +W056 */
    timer.on('timeout', function() {
      process.kill('SIGKILL');
    });

    process.on('exit', function() {
      timer.cancel();
    });
    // Instead of sending a real SIGINT, send a message to the sub-process and
    // let it treat it as if it received a SIGINT. SIGINT doesn't exist on
    // Windows.
    process.send({ type: 'sigint' });
  }
}
module.exports = softKill;
