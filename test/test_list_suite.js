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
var path = require('path');
var through = require('through');
var when = require('when');
var listSuite = require('../lib/list_suite');
var shouldFail = require('./util/should_fail');

function list(suite, timeout, childProcess) {
  return listSuite.listTestsOfFile(timeout || 2000, __dirname + '/../lib/interface/bdd_mocha', 'param', suite, childProcess);
}

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

    it('should elide error output when not present', function() {
      var error = new listSuite.ListTestError('suite_name');
      expect(error).property('stack').to.be.equal('suite_name');
    });

    it('should have a stack with the error output', function() {
      var error = new listSuite.ListTestError('suite_name', 'error\noutput');
      expect(error).property('stack').to.contain('error\noutput');
    });
  });

  describe('#listTestsOfFile', function() {
    it('should parse stdout JSON on success', function() {
      var suite = path.resolve(__dirname + '/suite/suite_single_successful_test');
      return list(suite)
        .then(function(result) {
          expect(result).to.be.deep.equal([{
            'path': {
              'file': suite,
              'path': ['should succeed']
            }
          }]);
        });
    });

    it('should fail with a ListTestError when the listing fails', function() {
      var suite = path.resolve(__dirname + '/suite/suite_syntax_error');
      return shouldFail(list(suite), function(error) {
        expect(error).property('message').to.match(/Failed to process .*suite_syntax_error/);
        expect(error).property('stack').to.match(/SyntaxError: Unexpected identifier/);
        return error instanceof listSuite.ListTestError;
      });
    });

    it('should fail with a timed out ListTestError when the listing times out', function() {
      var suite = path.resolve(__dirname + '/suite/suite_neverending_listing');
      return shouldFail(list(suite, 10), function(error) {
        expect(error).property('message').to.match(/Timed out while listing tests of .*suite_neverending_listing/);
        expect(error).property('stack').to.match(/Timed out while listing tests of .*suite_neverending_listing/);
        expect(error).property('timeout').to.be.true;
        return error instanceof listSuite.ListTestError;
      });
    });

    it('should kill the subprocess on timeout', function() {
      var killDeferred = when.defer();

      function fork() {
        return {
          stdout: through(),
          stderr: through(),
          on: function() {},
          kill: function(signal) {
            expect(signal).to.be.equal('SIGKILL');
            killDeferred.resolve();
          }
        };
      }

      var suite = path.resolve(__dirname + '/suite/suite_neverending_listing');
      return when.all([
        shouldFail(list(suite, 10, { fork: fork }), function(error) {
          return error instanceof listSuite.ListTestError;
        }),
        killDeferred.promise
      ]);
    });

    it('should provide the test interface parameter to the list_suite process', function() {
      var paramDeferred = when.defer();

      function fork(path, parameters) {
        expect(parameters).deep.property('[1]').to.be.equal('param');

        // Trick the listTestsOfFile function that the process closes
        paramDeferred.resolve();
        var out = through();
        return {
          stdout: out,
          stderr: through(),
          on: function(event, fn) {
            expect(event).to.be.equal('exit');
            fn(0);
            out.end();
          },
          kill: function() {}
        };
      }

      return when.all([
        list('dummy_suite', 100, { fork: fork }),
        paramDeferred.promise
      ]);
    });

    it('should provide the test interface parameter to the interface', function() {
      return listSuite.listTestsOfFile(1000, __dirname + '/util/dummy_parameterized_interface', 'test_param', 'suite')
        .then(function(result) {
          expect(result).to.be.deep.equal([
            { path: { file: 'suite', path: ['test_param'] } }
          ]);
        });
    });
  });
});
