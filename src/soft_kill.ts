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

import { ProcessLike } from './process_like';
import TimeoutTimer, { Timer } from './timeout_timer';

/**
 * Sends a faked sigint to a process. If it is still not dead after a short
 * while, it sends SIGKILL.
 */
export default function softKill(
  process: ProcessLike,
  timeout: number,
  timerFactory?: (timeout: number) => Timer
) {
  if (timeout === 0) {
    process.kill('SIGKILL');
    return;
  }

  const timer = timerFactory ? timerFactory(timeout) : new TimeoutTimer(timeout);
  timer.on('timeout', () => process.kill('SIGKILL'));

  process.on('exit', () => timer.cancel());
  // Catch any error that may occur as a result of killing the process.
  process.on('error', () => {});
  // Instead of sending a real SIGINT, try to send a message to the sub-process
  // and let it treat it as if it received a SIGINT. SIGINT doesn't exist on
  // Windows.
  process.send({ type: 'sigint' });
}

export type SoftKill = typeof softKill;
