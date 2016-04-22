/*
 * Copyright 2014-2016 Per Eckerdal
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

var _ = require('lodash');
var expect = require('chai').expect;
var stripAnsi = require('strip-ansi');
var SpecProgress = require('../lib/reporters/spec_progress');

function mock(methods) {
  return function Mock() {
    _.extend(this, methods);
  };
}

describe('Spec progress reporter', function() {
  describe('Constructor', function() {
    it('should pass stream to the InsertionLog', function() {
      return new Promise(function(resolve) {
        var stream = {};
        new SpecProgress({ stdout: stream }, function InsertionLog(param) {
          expect(stream).to.be.equal(param);
          resolve();
        });
      });
    });
  });

  describe('Suites', function() {
    function verifySuiteStartLog(path, expectedOutput) {
      return new Promise(function(resolve) {
        var reporter = new SpecProgress(null, mock({
          log: function(msg) {
            expect(msg).to.be.equal(expectedOutput);
            resolve();
          }
        }));

        var suitePath = { file: 'file', path: path };
        reporter.gotMessage(null, { type: 'suiteStart', suite: suitePath });
      });
    }

    it('should log suite name on suiteStart messages', function() {
      return verifySuiteStartLog(['suite'], '  suite');
    });

    it('should log suite name on suiteStart messages for the root suite', function() {
      return verifySuiteStartLog([], '');
    });
  });

  describe('Test start', function() {
    it('should log first test name after suite name', function() {
      var suiteLineId = null;

      return new Promise(function(resolve) {
        var reporter = new SpecProgress(null, mock({
          log: function(msg, id) {
            suiteLineId = id;
          },

          logAfter: function(afterId, line) {
            expect(suiteLineId).not.to.be.null;
            expect(suiteLineId).to.be.equal(afterId);
            expect(stripAnsi(line)).to.be.equal('    test');
            resolve();
          }
        }));

        var suitePath = { file: 'file', path: [] };
        var testPath = { file: 'file', path: ['test'] };
        reporter.gotMessage(null, { type: 'suiteStart', suite: suitePath });
        reporter.gotMessage(testPath, { type: 'start' });
      });
    });

    it('should log second test name after first test name', function() {
      var suiteLineId = null;
      var test1LineId = null;

      return new Promise(function(resolve) {
        var reporter = new SpecProgress(null, mock({
          log: function(msg, id) {
            suiteLineId = id;
          },

          logAfter: function(afterId, line, id) {
            expect(afterId).not.to.be.null;

            if (afterId === suiteLineId) {
              expect(stripAnsi(line)).to.contain('test1');
              test1LineId = id;
            } else {
              expect(afterId).to.be.equal(test1LineId);
              expect(stripAnsi(line)).to.contain('test2');
              resolve();
            }
          }
        }));

        var suitePath = { file: 'file', path: [] };
        var testPath1 = { file: 'file', path: ['test1'] };
        var testPath2 = { file: 'file', path: ['test2'] };
        reporter.gotMessage(null, { type: 'suiteStart', suite: suitePath });
        reporter.gotMessage(testPath1, { type: 'start' });
        reporter.gotMessage(testPath2, { type: 'start' });
      });
    });
  });

  describe('Test finish', function() {
    function verifyTestFinishLog(result, expectedOutput, extraFinishOptions) {
      var testLineId = null;

      return new Promise(function(resolve) {
        var reporter = new SpecProgress(null, mock({
          log: function() {},

          logAfter: function(afterId, line, id) {
            expect(stripAnsi(line)).to.contain('test');
            testLineId = id;
          },

          replace: function(replacedId, line) {
            expect(testLineId).to.not.be.null;
            expect(replacedId).to.be.equal(testLineId);
            expect(stripAnsi(line)).to.be.equal(expectedOutput);
            resolve();
          }
        }));

        var suitePath = { file: 'file', path: [] };
        var testPath = { file: 'file', path: ['test'] };
        reporter.gotMessage(null, { type: 'suiteStart', suite: suitePath });
        reporter.gotMessage(testPath, { type: 'start' });
        reporter.gotMessage(testPath, _.extend({ type: 'finish', result: result }, extraFinishOptions));
      });
    }

    it('should replace test name with success test marker', function() {
      return verifyTestFinishLog('success', '  ✓ test');
    });

    it('should replace test name with failure test marker', function() {
      return verifyTestFinishLog('failure', '  ✖ test');
    });

    it('should mark slow tests', function() {
      return verifyTestFinishLog('failure', '  ✖ test (12345ms)', { slow: true, duration: 12345 });
    });
  });

  describe('Stream piping', function() {
    ['stdout', 'stderr'].forEach(function(streamName) {
      describe(streamName, function() {
        it('should pipe the output from a test', function() {
          var testLineId = null;
          var testOutputLineId = null;

          return new Promise(function(resolve) {
            var reporter = new SpecProgress(null, mock({
              log: function() {},

              logAfter: function(afterId, line, id) {
                expect(afterId).to.not.be.null;

                if (line.match(/test/)) {
                  testLineId = id;
                } else if (afterId === testLineId) {
                  expect(line).to.be.equal('a_line');
                  testOutputLineId = id;
                } else if (afterId === testOutputLineId) {
                  expect(line).to.be.equal('a_second_line');
                  resolve();
                }
              }
            }));

            var suitePath = { file: 'file', path: [] };
            var testPath = { file: 'file', path: ['test'] };
            reporter.gotMessage(null, { type: 'suiteStart', suite: suitePath });
            reporter.gotMessage(testPath, { type: 'start' });

            reporter.gotMessage(testPath, {
              type: streamName,
              data: 'a_line\n'
            });
            reporter.gotMessage(testPath, {
              type: streamName,
              data: 'a_second_line\n'
            });
          });
        });
      });
    });
  });

  it('should do nothing on other messages', function() {
    var reporter = new SpecProgress(null, mock({}));
    reporter.gotMessage(null, { type: 'breadcrumb' });
  });
});
