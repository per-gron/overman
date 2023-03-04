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

import { TestPath } from './test_path';
import { suitePathOf } from './test_path_util';

function incrementValue(obj: Record<string, number>, key: string, by = 1) {
  obj[key] = (obj[key] ?? 0) + by;
}

/**
 * Test count is a helper class that operates on test paths and helps you to
 * keep track of how many tests there are in a given suite, including its
 * subsuites.
 *
 * Conceptually, TestCount is a set of test paths. You can add and remove tests
 * paths to the set, and you can query the set for how many tests there are in
 * a given suite.
 *
 * This is useful for example when you need to count remaining tests.
 */
export default class TestCount {
  // Map from serialized suite path to the number of tests that are remaining in
  // that suite, including non-direct descendants. (Suite path is simply a test
  // path without the test included).
  #testCounts: Record<string, number> = {};

  /**
   * For a given suite path, increment the number of tests in it and its ancestors
   * by a given amount.
   */
  private incrementValueForSuitePath(suitePath: TestPath | null, by?: number) {
    if (suitePath === null) {
      return;
    }
    incrementValue(this.#testCounts, JSON.stringify(suitePath), by);
    this.incrementValueForSuitePath(suitePathOf(suitePath), by);
  }

  addTest(testPath: TestPath) {
    this.incrementValueForSuitePath(suitePathOf(testPath));
  }

  /**
   * Helper method that is like addTest but it takes an array of test paths and
   * adds all of them.
   */
  addTests(testPaths: TestPath[]) {
    testPaths.forEach((testPath) => this.addTest(testPath));
  }

  removeTest(testPath: TestPath) {
    this.incrementValueForSuitePath(suitePathOf(testPath), -1);
  }

  numberOfTestsInSuite(suitePath: TestPath) {
    return this.#testCounts[JSON.stringify(suitePath)] ?? 0;
  }
}
