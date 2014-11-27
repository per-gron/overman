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

var bddMocha = require('../lib/interface/bdd_mocha');
var suiteRunner = require('../lib/suite_runner');

function parseSuite(name, runtimeContext) {
  return bddMocha(__dirname + '/suite/' + name, runtimeContext);
}

function getKeypath(object, keypath) {
  try {
    return (new Function('obj', 'return obj' + keypath))(object);
  } catch (e) {
    throw new Error('Object ' + object + ' does not contain keypath ' + keypath);
  }
}

function setKeypathToNull(object, keypath) {
  try {
    (new Function('obj', 'obj' + keypath + ' = null;'))(object);
  } catch (e) {
    throw new Error('Failed to set keypath ' + keypath + ' for object ' + object);
  }
}

function expectKeypathIsFunctionAndSetToNull(object, keypath) {
  var value = getKeypath(object, keypath);
  expect(value).to.be.a('function');
  setKeypathToNull(object, keypath);
}

describe('BDD interface (Mocha flavor)', function() {
  it('should handle empty test files', function() {
    expect(parseSuite('suite_empty')).to.be.deep.equal({
      type: 'suite',
      contents: []
    });
  });

  describe('Suites', function() {
    it('should handle describe suites with no body', function() {
      expect(parseSuite('suite_describe_without_body')).to.be.deep.equal({
        type: 'suite',
        contents: [{
          type: 'suite',
          contents: [],
          skipped: true,
          name: 'Skipped suite'
        }]
      });
    });

    it('should handle tests with no body', function() {
      expect(parseSuite('suite_test_without_body')).to.be.deep.equal({
        type: 'suite',
        contents: [{
          type: 'test',
          name: 'should be skipped',
          skipped: true
        }]
      });
    });

    it('should describe suites', function() {
      expect(parseSuite('suite_empty_describe')).to.be.deep.equal({
        type: 'suite',
        contents: [{
          type: 'suite',
          contents: [],
          name: 'Empty'
        }]
      });
    });
  });

  describe('Tests', function() {
    it('should declare tests with it', function() {
      var suite = parseSuite('suite_single_successful_test');
      expectKeypathIsFunctionAndSetToNull(suite, '.contents[0].run');
      expect(suite).to.be.deep.equal({
        type: 'suite',
        contents: [{
          type: 'test',
          name: 'should succeed',
          run: null
        }]
      });
    });

    it('should skip tests with it.skip', function() {
      var suite = parseSuite('suite_single_skipped_test');
      expectKeypathIsFunctionAndSetToNull(suite, '.contents[0].run');
      expect(suite).to.be.deep.equal({
        type: 'suite',
        contents: [{
          type: 'test',
          name: 'should be skipped',
          skipped: true,
          run: null
        }]
      });
    });

    it('should mark only tests with it.only', function() {
      var suite = parseSuite('suite_single_only_test');
      expectKeypathIsFunctionAndSetToNull(suite, '.contents[0].run');
      expect(suite).to.be.deep.equal({
        type: 'suite',
        contents: [{
          type: 'test',
          name: 'should be run only',
          only: true,
          run: null
        }]
      });
    });
  });

  describe('Hooks', function() {
    it('should declare before hooks', function() {
      var suite = parseSuite('suite_before_hook');
      expectKeypathIsFunctionAndSetToNull(suite, '.before[0].run');
      expect(suite).to.be.deep.equal({
        type: 'suite',
        contents: [],
        before: [{ run: null }]
      });
    });

    it('should declare beforeEach hooks', function() {
      var suite = parseSuite('suite_before_each_hook');
      expectKeypathIsFunctionAndSetToNull(suite, '.before[0].run');
      expect(suite).to.be.deep.equal({
        type: 'suite',
        contents: [],
        before: [{ run: null }]
      });
    });

    it('should declare after hooks', function() {
      var suite = parseSuite('suite_after_hook');
      expectKeypathIsFunctionAndSetToNull(suite, '.after[0].run');
      expect(suite).to.be.deep.equal({
        type: 'suite',
        contents: [],
        after: [{ run: null }]
      });
    });

    it('should declare afterEach hooks', function() {
      var suite = parseSuite('suite_after_each_hook');
      expectKeypathIsFunctionAndSetToNull(suite, '.after[0].run');
      expect(suite).to.be.deep.equal({
        type: 'suite',
        contents: [],
        after: [{ run: null }]
      });
    });

    it('should declare hooks with string names', function() {
      var suite = parseSuite('suite_before_hook_name');
      expectKeypathIsFunctionAndSetToNull(suite, '.before[0].run');
      expect(suite).to.be.deep.equal({
        type: 'suite',
        contents: [],
        before: [{
          name: 'before hook name',
          run: null
        }]
      });
    });

    it('should declare hooks with function names', function() {
      var suite = parseSuite('suite_before_hook_function_name');
      expectKeypathIsFunctionAndSetToNull(suite, '.before[0].run');
      expect(suite).to.be.deep.equal({
        type: 'suite',
        contents: [],
        before: [{
          name: 'beforeHookName',
          run: null
        }]
      });
    });

    it('should declare hooks within subsuites', function() {
      var suite = parseSuite('suite_before_hook_within_describe');
      expectKeypathIsFunctionAndSetToNull(suite, '.contents[0].before[0].run');
      expect(suite).to.be.deep.equal({
        type: 'suite',
        contents: [{
          type: 'suite',
          contents: [],
          name: 'Suite',
          before: [{ run: null }]
        }]
      });
    });
  });

  describe('Timeouts', function() {
    it('should allow getting the timeout for the current test', function() {
      var suite = parseSuite('suite_timeout_return', { getTimeout: function() {
        return 12345;
      }});
      var fn = getKeypath(suite, '.contents[0].run');
      expect(fn).to.be.a('function');
      expect(fn()).to.be.equal(12345);
    });

    it('should allow getting the timeout for the current test via the currentTest property', function() {
      var suite = parseSuite('suite_timeout_return_current_test', { getTimeout: function() {
        return 12345;
      }});
      var fn = getKeypath(suite, '.contents[0].run');
      expect(fn).to.be.a('function');
      expect(fn()).to.be.equal(12345);
    });

    it('should allow setting the timeout for the current test', function(done) {
      var suite = parseSuite('suite_timeout_set', { setTimeout: function(value) {
        expect(value).to.be.equal(10);
        done();
      }});
      var fn = getKeypath(suite, '.contents[0].run');
      fn();
    });

    it('should allow getting the timeout in a hook', function() {
      var suite = parseSuite('suite_timeout_return_in_hook', { getTimeout: function() {
        return 12345;
      }});
      var beforeFn = getKeypath(suite, '.before[0].run');
      expect(beforeFn).to.be.a('function');
      beforeFn();

      var fn = getKeypath(suite, '.contents[0].run');
      expect(fn).to.be.a('function');
      expect(fn()).to.be.equal(12345);
    });
  });

  describe('Slow thresholds', function() {
    it('should allow getting the timeout for the current test', function() {
      var suite = parseSuite('suite_slow_return', { getSlowThreshold: function() {
        return 23456;
      }});
      var fn = getKeypath(suite, '.contents[0].run');
      expect(fn).to.be.a('function');
      expect(fn()).to.be.equal(23456);
    });

    it('should allow setting the slow threshold for the current test', function(done) {
      var suite = parseSuite('suite_slow_set', { setSlowThreshold: function(value) {
        expect(value).to.be.equal(10);
        done();
      }});
      var fn = getKeypath(suite, '.contents[0].run');
      fn();
    });
  });

  it('should declare context global', function() {
    return suiteRunner({
      suites: [__dirname + '/suite/suite_access_context'],
      interface: __dirname + '/../lib/interface/bdd_mocha',
      timeout: 500,
      reporters: []
    });
  });
});
