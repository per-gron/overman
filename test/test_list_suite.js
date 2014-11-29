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

var expect = require('chai').expect;
var listSuite = require('../lib/list_suite');

describe('List suite', function() {
  describe('ListTestError', function() {
    it('should be instanceof Error', function() {
      expect(new listSuite.ListTestError() instanceof Error).to.be.true;
    });

    it('should have a message with the suite name', function() {
      var error = new listSuite.ListTestError('suite_name');
      expect(error).property('message').to.contain('suite_name');
    });

    it('should have a stack with the suite name', function() {
      var error = new listSuite.ListTestError('suite_name');
      expect(error).property('stack').to.contain('suite_name');
    });

    it('should have a stack with the error output', function() {
      var error = new listSuite.ListTestError('suite_name', 'error\noutput');
      expect(error).property('stack').to.contain('error\noutput');
    });
  });
});
