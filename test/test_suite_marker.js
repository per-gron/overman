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
var SuiteMarker = require('../lib/reporter/suite_marker');
var OnMessage = require('./util/on_message');

describe('SuiteMarker reporter', function() {
  describe('Forwarding', function() {
    it('should forward registerTests calls', function(done) {
      var path = { file: 'file', path: ['test'] };

      var reporter = {};
      reporter.registerTests = function(arg) {
        expect(arg).to.be.deep.equal([path]);
        done();
      };

      var suiteMarker = new SuiteMarker(reporter);
      suiteMarker.registerTests([path]);
    });

    ['registrationFailed', 'done', 'gotMessage'].forEach(function(message) {
      it('should forward ' + message + ' calls', function(done) {
        var path = { file: 'file', path: ['test'] };

        var reporter = {};
        reporter[message] = function(arg1, arg2) {
          expect(arg1).to.be.equal(path);
          expect(arg2).to.be.equal('arg2');
          done();
        };

        var suiteMarker = new SuiteMarker(reporter);
        suiteMarker.registerTests([path]);
        suiteMarker[message](path, 'arg2');
      });
    });
  });

  function testSuiteMarker(paths, actions) {
    var expectations = null;
    var suiteMarker = new SuiteMarker(new OnMessage(function(testPath, message) {
      if (expectations === null) {
        return;
      }

      var args = {
        testPath: testPath,
        message: message
      };

      expect(expectations, 'did not expect a message (got ' + JSON.stringify(args) + ')').to.not.be.empty;

      expect(args).to.be.deep.equal(expectations.shift());
    }));

    function updateExpectations(newExpectations) {
      if (expectations !== null) {
        expect(expectations, 'expectations need to be fulfilled').to.be.empty;
      }
      expectations = newExpectations;
    }

    suiteMarker.registerTests(paths);

    actions.forEach(function(action) {
      updateExpectations(action.expect || null);
      suiteMarker.gotMessage(action.emit.testPath, action.emit.message);
    });

    updateExpectations(null);
  }

  describe('suiteStart', function() {
    it('should emit suiteStart message', function() {
      var path = { file: 'file', path: ['test'] };
      var suitePath = { file: 'file', path: [] };

      testSuiteMarker([path], [
        {
          emit: { testPath: path, message: { type: 'start' } },
          expect: [
            { testPath: null, message: { type: 'suiteStart', suite: suitePath } },
            { testPath: path, message: { type: 'start' } }
          ]
        }
      ]);
    });

    it('should emit suiteStart message with time parameter', function(done) {
      var path = { file: 'file', path: ['test'] };
      var suitePath = { file: 'file', path: [] };
      var time = new Date();

      var suiteMarker = new SuiteMarker(new OnMessage(function(testPath, message, recievedTime) {
        if (message.type === 'suiteStart') {
          expect(recievedTime).to.be.deep.equal(time);
          done();
        }
      }));

      suiteMarker.registerTests([path]);
      suiteMarker.gotMessage(path, { type: 'start' }, time);
    });

    it('should emit suiteStart message only for the first test in a suite', function() {
      var path1 = { file: 'file', path: ['test1'] };
      var path2 = { file: 'file', path: ['test2'] };
      var suitePath = { file: 'file', path: [] };

      testSuiteMarker([path1, path2], [
        {
          emit: { testPath: path1, message: { type: 'start' } },
          expect: [
            { testPath: null, message: { type: 'suiteStart', suite: suitePath } },
            { testPath: path1, message: { type: 'start' } }
          ]
        },
        {
          emit: { testPath: path1, message: { type: 'finish' } },
          expect: [
            { testPath: path1, message: { type: 'finish' } }
          ]
        },
        {
          emit: { testPath: path2, message: { type: 'start' } },
          expect: [
            { testPath: path2, message: { type: 'start' } }
          ]
        }
      ]);
    });

    it('should emit suiteStart message only for the first test in a suite, even when tests are run in parallel', function() {
      var path1 = { file: 'file', path: ['test1'] };
      var path2 = { file: 'file', path: ['test2'] };
      var suitePath = { file: 'file', path: [] };

      testSuiteMarker([path1, path2], [
        {
          emit: { testPath: path1, message: { type: 'start' } },
          expect: [
            { testPath: null, message: { type: 'suiteStart', suite: suitePath } },
            { testPath: path1, message: { type: 'start' } }
          ]
        },
        {
          emit: { testPath: path2, message: { type: 'start' } },
          expect: [
            { testPath: path2, message: { type: 'start' } }
          ]
        }
      ]);
    });

    it('should emit suiteStart messages for ancestor tests as well when needed', function() {
      var path = { file: 'file', path: ['suite', 'test1'] };
      var suitePath1 = { file: 'file', path: [] };
      var suitePath2 = { file: 'file', path: ['suite'] };

      testSuiteMarker([path], [
        {
          emit: { testPath: path, message: { type: 'start' } },
          expect: [
            { testPath: null, message: { type: 'suiteStart', suite: suitePath1 } },
            { testPath: null, message: { type: 'suiteStart', suite: suitePath2 } },
            { testPath: path, message: { type: 'start' } }
          ]
        }
      ]);
    });
  });

  describe('suiteFinish', function() {
    it('should emit suiteFinish message', function() {
      var path = { file: 'file', path: ['test'] };
      var suitePath = { file: 'file', path: [] };

      testSuiteMarker([path], [
        { emit: { testPath: path, message: { type: 'start' } } },
        {
          emit: { testPath: path, message: { type: 'finish' } },
          expect: [
            { testPath: path, message: { type: 'finish' } },
            { testPath: null, message: { type: 'suiteFinish', suite: suitePath } }
          ]
        }
      ]);
    });

    it('should emit suiteFinish message with time parameter', function(done) {
      var path = { file: 'file', path: ['test'] };
      var suitePath = { file: 'file', path: [] };
      var time = new Date();

      var suiteMarker = new SuiteMarker(new OnMessage(function(testPath, message, recievedTime) {
        if (message.type === 'suiteFinish') {
          expect(recievedTime).to.be.deep.equal(time);
          done();
        }
      }));

      suiteMarker.registerTests([path]);
      suiteMarker.gotMessage(path, { type: 'start' });
      suiteMarker.gotMessage(path, { type: 'finish' }, time);
    });

    it('should emit suiteFinish message when all tests in the suite are finished', function() {
      var path1 = { file: 'file', path: ['test1'] };
      var path2 = { file: 'file', path: ['test2'] };
      var suitePath = { file: 'file', path: [] };

      testSuiteMarker([path1, path2], [
        { emit: { testPath: path1, message: { type: 'start' } } },
        {
          emit: { testPath: path1, message: { type: 'finish' } },
          expect: [
            { testPath: path1, message: { type: 'finish' } },
          ]
        },
        { emit: { testPath: path2, message: { type: 'start' } } },
        {
          emit: { testPath: path2, message: { type: 'finish' } },
          expect: [
            { testPath: path2, message: { type: 'finish' } },
            { testPath: null, message: { type: 'suiteFinish', suite: suitePath } }
          ]
        }
      ]);
    });

    it('should emit suiteFinish message when all tests, including tests in subsuites, are finished', function() {
      var path1 = { file: 'file', path: ['test1'] };
      var suitePath1 = { file: 'file', path: [] };
      var path2 = { file: 'file', path: ['suite', 'test2'] };
      var suitePath2 = { file: 'file', path: ['suite'] };

      testSuiteMarker([path1, path2], [
        { emit: { testPath: path1, message: { type: 'start' } } },
        {
          emit: { testPath: path1, message: { type: 'finish' } },
          expect: [
            { testPath: path1, message: { type: 'finish' } }
          ]
        },
        { emit: { testPath: path2, message: { type: 'start' } } },
        {
          emit: { testPath: path2, message: { type: 'finish' } },
          expect: [
            { testPath: path2, message: { type: 'finish' } },
            { testPath: null, message: { type: 'suiteFinish', suite: suitePath2 } },
            { testPath: null, message: { type: 'suiteFinish', suite: suitePath1 } }
          ]
        }
      ]);
    });
  });
});
