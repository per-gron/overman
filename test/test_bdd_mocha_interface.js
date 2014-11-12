'use strict';

var expect = require('chai').expect;

var bddMocha = require('../lib/interface/bdd_mocha');

function parseSuite(name) {
  return bddMocha(__dirname + '/suite/' + name);
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
