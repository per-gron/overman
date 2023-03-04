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

var bddMocha = require('../dist/interfaces/bdd_mocha');
var suiteRunner = require('../dist/suite_runner');

function parseSuite(name, runtimeContext) {
  return bddMocha(undefined, __dirname + '/../test/suite/' + name, runtimeContext);
}

function getKeypath(object, keypath) {
  try {
    return new Function('obj', 'return obj' + keypath)(object);
  } catch (e) {
    throw new Error('Object ' + object + ' does not contain keypath ' + keypath);
  }
}

function setKeypathToNull(object, keypath) {
  try {
    new Function('obj', 'obj' + keypath + ' = null;')(object);
  } catch (e) {
    throw new Error('Failed to set keypath ' + keypath + ' for object ' + object);
  }
}

function expectKeypathIsFunctionAndSetToNull(object, keypath) {
  var value = getKeypath(object, keypath);
  expect(value).to.be.a('function');
  setKeypathToNull(object, keypath);
}

describe('BDD interface (Mocha flavor)', function () {
  it('should handle empty test files', function () {
    expect(parseSuite('suite_empty')).to.be.deep.equal({
      type: 'suite',
      contents: [],
    });
  });

  describe('Suites', function () {
    it('should handle describe suites with no body', function () {
      expect(parseSuite('suite_describe_without_body')).to.be.deep.equal({
        type: 'suite',
        contents: [
          {
            type: 'suite',
            contents: [],
            skipped: true,
            name: 'Skipped suite',
          },
        ],
      });
    });

    it('should handle tests with no body', function () {
      expect(parseSuite('suite_test_without_body')).to.be.deep.equal({
        type: 'suite',
        contents: [
          {
            type: 'test',
            name: 'should be skipped',
            skipped: true,
          },
        ],
      });
    });

    it('should describe suites', function () {
      expect(parseSuite('suite_empty_describe')).to.be.deep.equal({
        type: 'suite',
        contents: [
          {
            type: 'suite',
            contents: [],
            name: 'Empty',
          },
        ],
      });
    });
  });

  describe('Tests', function () {
    it('should declare tests with it', function () {
      var suite = parseSuite('suite_single_successful_test');
      expectKeypathIsFunctionAndSetToNull(suite, '.contents[0].run');
      expect(suite).to.be.deep.equal({
        type: 'suite',
        contents: [
          {
            type: 'test',
            name: 'should succeed',
            run: null,
          },
        ],
      });
    });

    it('should declare tests with attributes with it', function () {
      var suite = parseSuite('suite_attributes');
      expectKeypathIsFunctionAndSetToNull(suite, '.contents[0].contents[0].run');
      expectKeypathIsFunctionAndSetToNull(suite, '.contents[0].contents[1].run');
      expect(suite).to.be.deep.equal({
        type: 'suite',
        contents: [
          {
            type: 'suite',
            name: 'suite',
            attributes: { foo: 'bar', bar: 'qux' },
            contents: [
              {
                type: 'test',
                name: 'should override',
                attributes: { foo: 'baz', bar: 'qux' },
                run: null,
              },
              {
                type: 'test',
                name: 'should override again',
                attributes: { foo: 'quux', bar: 'qux' },
                run: null,
              },
            ],
          },
        ],
      });
    });

    it('should skip tests with it.skip', function () {
      var suite = parseSuite('suite_single_skipped_test');
      expectKeypathIsFunctionAndSetToNull(suite, '.contents[0].run');
      expect(suite).to.be.deep.equal({
        type: 'suite',
        contents: [
          {
            type: 'test',
            name: 'should be skipped',
            skipped: true,
            run: null,
          },
        ],
      });
    });

    it('should mark only tests with it.only', function () {
      var suite = parseSuite('suite_single_only_test');
      expectKeypathIsFunctionAndSetToNull(suite, '.contents[0].run');
      expect(suite).to.be.deep.equal({
        type: 'suite',
        contents: [
          {
            type: 'test',
            name: 'should be run only',
            only: true,
            run: null,
          },
        ],
      });
    });

    it('should mark unstable tests with it.unstable', function () {
      var suite = parseSuite('suite_single_unstable_test');
      expectKeypathIsFunctionAndSetToNull(suite, '.contents[0].run');
      expect(suite).to.be.deep.equal({
        type: 'suite',
        contents: [
          {
            type: 'test',
            name: 'should be run if unstable',
            unstable: true,
            run: null,
          },
        ],
      });
    });
  });

  describe('Hooks', function () {
    it('should declare before hooks', function () {
      var suite = parseSuite('suite_before_hook');
      expectKeypathIsFunctionAndSetToNull(suite, '.before[0].run');
      expect(suite).to.be.deep.equal({
        type: 'suite',
        contents: [],
        before: [{ run: null }],
      });
    });

    it('should declare beforeEach hooks', function () {
      var suite = parseSuite('suite_before_each_hook');
      expectKeypathIsFunctionAndSetToNull(suite, '.before[0].run');
      expect(suite).to.be.deep.equal({
        type: 'suite',
        contents: [],
        before: [{ run: null }],
      });
    });

    it('should declare after hooks', function () {
      var suite = parseSuite('suite_after_hook');
      expectKeypathIsFunctionAndSetToNull(suite, '.after[0].run');
      expect(suite).to.be.deep.equal({
        type: 'suite',
        contents: [],
        after: [{ run: null }],
      });
    });

    it('should declare afterEach hooks', function () {
      var suite = parseSuite('suite_after_each_hook');
      expectKeypathIsFunctionAndSetToNull(suite, '.after[0].run');
      expect(suite).to.be.deep.equal({
        type: 'suite',
        contents: [],
        after: [{ run: null }],
      });
    });

    it('should declare hooks with string names', function () {
      var suite = parseSuite('suite_before_hook_name');
      expectKeypathIsFunctionAndSetToNull(suite, '.before[0].run');
      expect(suite).to.be.deep.equal({
        type: 'suite',
        contents: [],
        before: [
          {
            name: 'before hook name',
            run: null,
          },
        ],
      });
    });

    it('should declare hooks with function names', function () {
      var suite = parseSuite('suite_before_hook_function_name');
      expectKeypathIsFunctionAndSetToNull(suite, '.before[0].run');
      expect(suite).to.be.deep.equal({
        type: 'suite',
        contents: [],
        before: [
          {
            name: 'beforeHookName',
            run: null,
          },
        ],
      });
    });

    it('should declare hooks within subsuites', function () {
      var suite = parseSuite('suite_before_hook_within_describe');
      expectKeypathIsFunctionAndSetToNull(suite, '.contents[0].before[0].run');
      expect(suite).to.be.deep.equal({
        type: 'suite',
        contents: [
          {
            type: 'suite',
            contents: [],
            name: 'Suite',
            before: [{ run: null }],
          },
        ],
      });
    });
  });

  describe('Timeouts', function () {
    it('should allow getting the timeout for the current test', function () {
      var suite = parseSuite('suite_timeout_return', {
        getTimeout: function () {
          return 12345;
        },
      });
      var fn = getKeypath(suite, '.contents[0].run');
      expect(fn).to.be.a('function');
      expect(fn()).to.be.equal(12345);
    });

    it('should allow getting the timeout for the current test via the currentTest property', function () {
      var suite = parseSuite('suite_timeout_return_current_test', {
        getTimeout: function () {
          return 12345;
        },
      });
      var fn = getKeypath(suite, '.contents[0].run');
      expect(fn).to.be.a('function');
      expect(fn()).to.be.equal(12345);
    });

    it('should allow setting the timeout for the current test', function (done) {
      var suite = parseSuite('suite_timeout_set', {
        setTimeout: function (value) {
          expect(value).to.be.equal(10);
          done();
        },
      });
      var fn = getKeypath(suite, '.contents[0].run');
      fn();
    });

    it('should allow getting the timeout in a hook', function () {
      var suite = parseSuite('suite_timeout_return_in_hook', {
        getTimeout: function () {
          return 12345;
        },
      });
      var beforeFn = getKeypath(suite, '.before[0].run');
      expect(beforeFn).to.be.a('function');
      beforeFn();

      var fn = getKeypath(suite, '.contents[0].run');
      expect(fn).to.be.a('function');
      expect(fn()).to.be.equal(12345);
    });

    it('should allow setting the timeout in a suite', function () {
      var rootSuite = parseSuite('suite_timeout_set_in_suite');
      var suite = getKeypath(rootSuite, '.contents[0]');
      expect(suite).property('timeout').to.be.equal(1234);
    });

    it('should allow reading timeout overrides in suites', function () {
      parseSuite('suite_timeout_read_in_suite');
    });

    it('should shadow but not overwrite when reading the timeout in a subsuite', function () {
      parseSuite('suite_timeout_get_in_subsuite');
    });
  });

  describe('Slow thresholds', function () {
    it('should allow getting the timeout for the current test', function () {
      var suite = parseSuite('suite_slow_return', {
        getSlowThreshold: function () {
          return 23456;
        },
      });
      var fn = getKeypath(suite, '.contents[0].run');
      expect(fn).to.be.a('function');
      expect(fn()).to.be.equal(23456);
    });

    it('should allow setting the slow threshold for the current test', function (done) {
      var suite = parseSuite('suite_slow_set', {
        setSlowThreshold: function (value) {
          expect(value).to.be.equal(20);
          done();
        },
      });
      var fn = getKeypath(suite, '.contents[0].run');
      fn();
    });

    it('should allow setting the slow threshold in a suite', function () {
      var rootSuite = parseSuite('suite_slow_set_in_suite');
      var suite = getKeypath(rootSuite, '.contents[0]');
      expect(suite).property('slow').to.be.equal(1234);
    });
  });

  describe('Breadcrumbs', function () {
    it('should allow leaving breadcrumbs', function (done) {
      var suite = parseSuite('suite_leave_breadcrumb', {
        leaveBreadcrumb: function (message, trace) {
          expect(message).to.be.equal('A breadcrumb');
          expect(trace).to.contain('suite_leave_breadcrumb.js:');
          done();
        },
      });
      var fn = getKeypath(suite, '.contents[0].run');
      fn();
    });

    it('should allow leaving breadcrumbs that are Error objects', function (done) {
      var suite = parseSuite('suite_leave_error_breadcrumb', {
        leaveBreadcrumb: function (message, trace) {
          expect(message).to.be.equal('An Error breadcrumb');
          expect(trace).to.contain('suite_leave_error_breadcrumb.js:');
          done();
        },
      });
      var fn = getKeypath(suite, '.contents[0].run');
      fn();
    });
  });

  describe('Debug info', function () {
    it('should allow emitting debug info', function (done) {
      var suite = parseSuite('suite_emit_debug_info', {
        emitDebugInfo: function (name, value) {
          expect(name).to.be.equal('name');
          expect(value).to.be.deep.equal({ the: 'value' });
          done();
        },
      });
      var fn = getKeypath(suite, '.contents[0].run');
      fn();
    });
  });

  describe('Duplicates', function () {
    it('should fail when encountering duplicate tests', function () {
      expect(function () {
        parseSuite('suite_duplicate_test');
      }).to.throw(/Redefining test/);
    });

    it('should fail when encountering duplicate suites', function () {
      expect(function () {
        parseSuite('suite_duplicate_suite');
      }).to.throw(/Redefining suite/);
    });

    it('should fail when encountering duplicate tests and suites', function () {
      expect(function () {
        parseSuite('suite_duplicate_test_and_suite');
      }).to.throw(/Redefining suite/);
    });
  });

  it('should declare context global', function () {
    return suiteRunner({
      files: [__dirname + '/../test/suite/suite_access_context'],
      interface: __dirname + '/../dist/interfaces/bdd_mocha',
      timeout: 500,
      reporters: [],
    });
  });
});
