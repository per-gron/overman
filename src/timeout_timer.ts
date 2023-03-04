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

import { EventEmitter } from 'events';

export interface Timer extends EventEmitter {
  updateTimeout(timeout: number): void;
  cancel(): void;
}

export class FakeTimer extends EventEmitter implements Timer {
  public updates: number[] = [];

  constructor(public cancel = () => {}) {
    super();
  }
  updateTimeout(t: number) {
    this.updates.push(t);
  }
}

export interface Options {
  clock?: () => number;
  setTimeout?: (cb: () => void, t: number) => number;
  clearTimeout?: (t: number) => void;
}

/**
 * TimeoutTimer is a class that sets a timer similarly to setTimeout. The
 * difference is that TimeoutTimer also supports changing the timeout while
 * it's running. This is used for test timeouts; the tests can change their
 * own timeout while they are run. (Yes, this is a bit crazy, but I want to
 * be mocha compatible.)
 *
 * TimeoutTimer is an EventEmitter and will emit a 'timeout' message when the
 * time is up.
 *
 * @param timeout The timeout in milliseconds
 * @param options For testing purposes and other customization, it's possible
 *     to inject non-standard means of measuring time and setting timeouts.
 *     {
 *       clock: [function that returns the current time as a Date object],
 *       setTimeout: [set a timeout. Same signature as Javascript's setTimeout.
 *         Rhis function should always invoke its callback asynchronously],
 *       clearTimeout: [cancel a timeout. Same signature as Javascript's clearTimeout]
 *     }
 *     Optional.
 */
export default class TimeoutTimer extends EventEmitter implements Timer {
  #clock: () => number;
  #startTime: number;
  #setTimeout: NonNullable<Options['setTimeout']>;
  #clearTimeout: NonNullable<Options['clearTimeout']>;
  #timeoutToken: number | null = null;

  constructor(private timeout: number, { clock = () => Date.now(), ...opts }: Options = {}) {
    super();
    this.#clock = clock;
    this.#startTime = this.#clock();
    this.#setTimeout = opts.setTimeout ?? setTimeout;
    this.#clearTimeout = opts.clearTimeout ?? clearTimeout;

    this.armTimeout();
  }

  private timedOut() {
    this.#timeoutToken = null;
    this.emit('timeout', this.timeout);
  }

  /**
   * Calculate the remaining time for this timeout. May return a negative number.
   */
  private remainingTime() {
    return this.timeout - (this.#clock() - this.#startTime);
  }

  private armTimeout() {
    if (this.#timeoutToken !== null) {
      this.#clearTimeout(this.#timeoutToken);
    }

    const remainingTime = this.remainingTime();
    if (remainingTime > 0) {
      this.#timeoutToken = this.#setTimeout(() => this.timedOut(), remainingTime);
    } else {
      process.nextTick(() => this.timedOut());
    }
  }

  /**
   * Change the timeout of this object. The timeout is relative from when the
   * timer was created. Setting the timeout to a time that has already passed
   * causes the timer to elapse immediately (on the next tick).
   */
  updateTimeout(timeout: number) {
    if (this.#timeoutToken === null) {
      throw new Error('Cannot updateTimeout on timer that has elapsed');
    }

    this.timeout = timeout;
    this.armTimeout();
  }

  /**
   * Cancel the timer.
   */
  cancel() {
    this.#timeoutToken != null && this.#clearTimeout(this.#timeoutToken);
    this.#timeoutToken = null;
  }
}
