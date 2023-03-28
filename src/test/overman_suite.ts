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

import * as fs from 'fs';
import * as path from 'path';
import overman, { reporters as overmanReporters } from '..';

const suiteFiles = fs
  .readdirSync('dist/test')
  .filter((filename) => filename.match(/^test_.*\.js$/))
  .map((filename) => path.join('dist/test', filename));

const reporters = [
  new overmanReporters.Spec(process),
  new overmanReporters.Summary(process.stdout),
];

const ctrl = new AbortController();

let finished = false;

process.on('SIGINT', () => {
  if (finished) {
    // It is possible that the test suite has finished running, but that
    // something is still left on the runloop. In that case, we shoulnd't
    // prevent the user from shutting down the process.
    process.exit(1);
  } else {
    ctrl.abort();
  }
});

async function main() {
  try {
    await overman({ files: suiteFiles, reporters, signal: ctrl.signal });
    finished = true;
  } catch (_: unknown) {
    finished = true;
    process.exit(1);
  }
}

main();
