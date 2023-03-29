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

import { Writable } from 'stream';
import Combined from './combined';
import ErrorDetail from './error_detail';
import SpecProgress from './spec_progress';
import SuiteMarker from './suite_marker';
import Summary from './summary';
import Timer from './timer';

export type Streams = { stdout: Writable };

/**
 * Spec is a reporter that combines other reporters to form a complete bdd spec
 * style reporter. Please don't add logic to this class, it's supposed to only
 * combine other reporters. One reason for this is raw elegance, another is that
 * it is rather hard to test things on this high level.
 *
 * @param streams An object of the form { stdout: y, stderr: z }.
 *     Output and results of tests will be piped to these streams. All three
 *     streams are optional: if a stream is missing, the test output for that
 *     stream is ignored. The parameter itself is optional too; if nothing is
 *     passed, things are printed to the stdio streams of the process.
 */
export default class Spec extends Combined {
  constructor({ stdout }: Streams = process) {
    super([
      new Timer(new SuiteMarker(new SpecProgress({ stdout }))),
      new Summary(stdout),
      new ErrorDetail(stdout),
    ]);
  }
}
