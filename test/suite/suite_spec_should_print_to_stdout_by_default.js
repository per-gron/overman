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

var Spec = require('../../lib/reporters/spec');

describe('Spec reporter', function() {
  it('should print to stdout by default', function() {
    var spec = new Spec();

    var path = { file: 'file', path: ['suite_name', 'test'] };
    spec.registerTests([path], { slowThreshold: 100 }, new Date());
    spec.gotMessage(path, { type: 'start' });
  });
});