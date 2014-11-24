'use strict';

var stripAnsi = require('strip-ansi');
var through = require('through');
var chalk = require('chalk');
var Summary = require('../lib/reporter/summary');
var makeFakeClock = require('./util/fake_clock');
var streamUtil = require('./util/stream');

function stripAnsiStream() {
  return through(function(data) {
    this.emit('data', stripAnsi(data));
  });
}

function performActionsAndCheckOutput(actions, output, options) {
  var stripped = (options || {}).dontStrip ? through() : stripAnsiStream();
  var summary = new Summary(stripped, (options || {}).getTime);

  var promise = streamUtil.waitForStreamToEmitLines(stripped, output);

  actions(summary);

  stripped.end();

  return promise;
}

describe('Summary reporter', function() {
  before(function() {
    chalk.enabled = true;
  });

  it('should always report passing tests, even when no tests pass', function() {
    return performActionsAndCheckOutput(function(summary) {
      summary.registerTests([]);
      summary.done();
    }, [
      '',
      /0 passing/,
      ''
    ]);
  });

  it('should report number of passed tests', function() {
    return performActionsAndCheckOutput(function(summary) {
      summary.registerTests([]);
      summary.gotMessage(null, { type: 'finish', result: 'success' });
      summary.done();
    }, [
      '',
      /1 passing/,
      ''
    ]);
  });

  it('should report total time it took for tests to run', function() {
    var clock = makeFakeClock();

    return performActionsAndCheckOutput(function(summary) {
      summary.registerTests([]);
      clock.step(4000);
      summary.done();
    }, [
      '',
      /(4s)/,
      ''
    ], { getTime: clock });
  });

  it('should report number of skipped tests', function() {
    return performActionsAndCheckOutput(function(summary) {
      summary.registerTests([]);
      summary.gotMessage(null, { type: 'finish', result: 'skipped' });
      summary.done();
    }, [
      '',
      /0 passing/,
      /1 skipped/,
      ''
    ]);
  });

  it('should report number of failing tests', function() {
    return performActionsAndCheckOutput(function(summary) {
      summary.registerTests([]);
      summary.gotMessage(null, { type: 'finish', result: 'failure' });
      summary.done();
    }, [
      '',
      /0 passing/,
      /1 failing/,
      ''
    ]);
  });

  it('should report number of skipped and number of failing tests', function() {
    return performActionsAndCheckOutput(function(summary) {
      summary.registerTests([]);
      summary.gotMessage(null, { type: 'finish', result: 'failure' });
      summary.gotMessage(null, { type: 'finish', result: 'skipped' });
      summary.done();
    }, [
      '',
      /0 passing/,
      /1 skipped/,
      /1 failing/,
      ''
    ]);
  });

  it('should color the passing tests text', function() {
    return performActionsAndCheckOutput(function(summary) {
      summary.registerTests([]);
      summary.done();
    }, [
      '',
      new RegExp('\u001b\\[32m0 passing\u001b\\[39m'),
      ''
    ], { dontStrip: true });
  });

  it('should color the test time text', function() {
    return performActionsAndCheckOutput(function(summary) {
      summary.registerTests([]);
      summary.done();
    }, [
      '',
      new RegExp('\u001b\\[90m\\(0s\\)\u001b\\[39m'),
      ''
    ], { dontStrip: true });
  });

  it('should color the skipped tests text', function() {
    return performActionsAndCheckOutput(function(summary) {
      summary.registerTests([]);
      summary.gotMessage(null, { type: 'finish', result: 'skipped' });
      summary.done();
    }, [
      '',
      /passing/,
      new RegExp('\u001b\\[36m1 skipped\u001b\\[39m'),
      ''
    ], { dontStrip: true });
  });

  it('should color the failing tests text', function() {
    return performActionsAndCheckOutput(function(summary) {
      summary.registerTests([]);
      summary.gotMessage(null, { type: 'finish', result: 'failure' });
      summary.done();
    }, [
      '',
      /passing/,
      new RegExp('\u001b\\[31m1 failing\u001b\\[39m'),
      ''
    ], { dontStrip: true });
  });
});
