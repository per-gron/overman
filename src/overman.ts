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

/// <reference path="interfaces/bdd_mocha.globals.ts" />

'use strict';

import * as suiteRunner from './suite_runner';
import reporters = require('./reporters');
import TestFailureError = require('./test_failure_error');

export = Object.assign(suiteRunner, { reporters, TestFailureError });
