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

import * as path from 'path';
import * as recursive from 'recursive-readdir';

// The scripts can't just be required. They are tested though so it
// doesn't hurt much.
const RESERVED = ['list_suite.js', 'run_test.js'];

// This doesn't actually test for anything per se. Its purpose is to make sure
// that all source files are required by at least one test, so that the test
// coverage reporting is accurate.
it('should require all files', async function () {
  const files = await recursive(`${__dirname}/..`);
  await Promise.all(
    files
      .filter((file) => !file.startsWith(__dirname) && file.endsWith('.js'))
      .filter((file) => !RESERVED.includes(path.basename(file)))
      .map((file) => import(file))
  );
});
