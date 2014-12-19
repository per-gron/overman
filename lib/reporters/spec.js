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

var Combined = require('./combined');
var ErrorDetail = require('./error_detail');
var Pipe = require('./pipe');
var SpecProgress = require('./spec_progress');
var SuiteMarker = require('./suite_marker');
var Summary = require('./summary');
var Timer = require('./timer');

/**
 * Spec is a reporter that combines other reporters to form a complete bdd spec
 * style reporter. Please don't add logic to this class, it's supposed to only
 * combine other reporters. One reason for this is raw elegance, another is that
 * it is rather hard to test things on this high level.
 */
function Spec(streams) {
  Combined.call(this, [
    new Pipe(streams),
    new Timer(new SuiteMarker(new SpecProgress(streams.stdout))),
    new Summary(streams.stdout),
    new ErrorDetail(streams.stdout)
  ]);
}
Spec.prototype = Object.create(Combined.prototype);

module.exports = Spec;
