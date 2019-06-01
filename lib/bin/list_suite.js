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

/**
 * This file is a runnable script that takes two command line arguments:
 *
 * 1) An absolute path to the test interface
 * 2) An absolute path to the suite file
 *
 * Its output is a list of the tests that are declared in the suite file,
 * in JSON format to stdout.
 */

'use strict';

var _ = require('lodash');

function only(object, keys) {
  return _.pickBy(object, function(value, key) { return _.indexOf(keys, key) !== -1; });
}

var propertyKeys = ['skipped', 'only', 'timeout', 'slow'];

function testsOfSuite(file, suite, suitePath, properties) {
  suitePath = suitePath || [];

  if (suite.attributes) {
    properties = properties || {};
    properties.attributes = _.assign(properties.attributes, suite.attributes);
  }
  if (suite.type === 'test') {
    return [_.assign({
      path: {
        file: file,
        path: suitePath.concat([suite.name])
      }
    }, only(suite, propertyKeys), properties)];
  } else if (suite.type === 'suite') {
    var subPath = suite.name ? suitePath.concat([suite.name]) : suitePath;
    return _.flatten(suite.contents.map(function(subSuite) {
      return testsOfSuite(file, subSuite, subPath, _.assign(only(subSuite, propertyKeys), properties));
    }), true);
  } else {
    throw new Error('Unrecognized suite type ' + suite.type);
  }
}

var testInterfacePath = process.argv[2];
var testInterfaceParameter = process.argv[3];
var testFile = process.argv[4];

var testInterface = require(testInterfacePath);
var suite = testInterface(testInterfaceParameter, testFile);

console.log(JSON.stringify(testsOfSuite(testFile, suite)));
