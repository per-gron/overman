'use strict';

var through = require('through');
var when = require('when');
var Pipe = require('../lib/reporter/pipe');
var suiteRunner = require('../lib/suite_runner');
var streamUtil = require('./util/stream');

function runSuite(suite, reporter) {
  return suiteRunner({
      suites: [__dirname + '/suite/' + suite],
      interface: './lib/interface/bdd_mocha',
      reporters: [reporter]
    });
}

describe('Pipe reporter', function() {
  it('should be capable of being constructed with no streams', function() {
    return runSuite('suite_single_successful_test', new Pipe({}));
  });

  it('should pipe stdout', function() {
    var stream = through();
    var suitePromise = runSuite('suite_single_successful_test', new Pipe({ stdout: stream }));
    return when.all([
      streamUtil.waitForStreamToEmitLines(stream, [
        /running_test/
      ]),
      suitePromise
    ]);
  });

  it('should pipe stderr', function() {
    var stream = through();
    var suitePromise = runSuite('suite_test_that_prints_to_stderr', new Pipe({ stderr: stream }));
    return when.all([
      streamUtil.waitForStreamToEmitLines(stream, [
        /printing_to_stderr/
      ]),
      suitePromise
    ]);
  });
});
