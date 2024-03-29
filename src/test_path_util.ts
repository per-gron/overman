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

/**
 * Get the path to the suite of the given test or suite.
 */
export function suitePathOf(testPath: TestPath): TestPath | null {
  if (testPath.path.length === 0) {
    return null;
  }
  return {
    file: testPath.file,
    path: testPath.path.slice(0, -1),
  };
}
