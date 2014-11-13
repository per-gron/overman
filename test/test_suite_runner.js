'use strict';

var _ = require('underscore');
var expect = require('chai').expect;
var when = require('when');
var OnMessage = require('./util/on_message');
var stream = require('./util/stream');
var suiteRunner = require('../lib/suite_runner');


function ParallelismCounter() {
  this.maxParallelism = 0;
  this._currentTests = {};
}

ParallelismCounter.prototype.gotMessage = function(testPath, message) {
  var pathAsString = JSON.stringify(testPath);
  if (message.type === 'begin') {
    this._currentTests[pathAsString] = true;

    this.maxParallelism = Math.max(this.maxParallelism, _.keys(this._currentTests).length);
  } else if (message.type === 'finish') {
    delete this._currentTests[pathAsString];
  }
};


function listNames(names) {
  return names
    .map(function(name) { return '"' + name + '"'; })
    .join(', ');
}

function shouldFail(promise) {
  return promise
      .then(function() {
        throw new Error('Should fail');
      }, function() {
        // Should fail
      });
}

function runTestSuite(suite, reporters, options) {
  return suiteRunner(_.extend({
      suites: [__dirname + '/suite/' + suite],
      interface: __dirname + '/../lib/interface/bdd_mocha',
      timeout: 500,
      reporters: reporters || []
    }, options));
}

/**
 * A function that takes a test suite and a dictionary from test names to
 * an array of the lines that the given test should print to stdout.
 *
 * Returns a promise that succeeds only if all tests succeed, only tests
 * that were specified are run and the test output exactly matchess the
 * specification.
 */
function ensureOutputFromTests(suite, tests) {
  var gotStdioForTests = [];
  var reporters = [];
  var encounteredTests = {};

  var testsPromises = _.keys(tests).map(function(testName) {
    var lines = tests[testName];
    return when.promise(function(resolve, reject) {
      reporters.push(new OnMessage(function(testPath, message) {
        if (testPath.path.length !== 1) {
          throw new Error('Subsuites are not supported');
        }
        encounteredTests[testPath.path[0]] = true;

        if (_.isEqual(testPath.path, [testName]) && message.type === 'stdio') {
          gotStdioForTests.push(testName);
          stream.waitForStreamToEmitLines(message.stdout, lines)
            .done(resolve, reject);
        }
      }));
    });
  });

  var suitePromise = runTestSuite(suite, reporters)
    .then(function() {
      var testNames = _.keys(tests);
      if (gotStdioForTests.length < testNames.length) {
        var missingTests = _.difference(testNames, gotStdioForTests);

        throw new Error('Did not run all tests (ran ' + listNames(gotStdioForTests) + '. Missing ' + listNames(missingTests) + ')');
      }
    });

  return when.all(testsPromises.concat([suitePromise]))
    .then(function() {
      if (!_.isEqual(_.keys(encounteredTests).sort(), _.keys(tests).sort())) {
        throw new Error('Encountered unexpected tests ' + listNames(_.difference(_.keys(encounteredTests), _.keys(tests))));
      }
    });
}

describe('Suite runner', function() {
  it('should run tests', function() {
    return ensureOutputFromTests('suite_single_successful_test', {
      'should succeed': [ /running_test/ ]
    });
  });

  it('should not run skipped tests', function() {
    return ensureOutputFromTests('suite_single_skipped_test', {});
  });

  it('should run only test that were marked as only', function() {
    return ensureOutputFromTests('suite_only_test_amongst_others', {
      'should be run': [ /should_be_run/ ]
    });
  });

  it('should run only tests that were marked as only', function() {
    return ensureOutputFromTests('suite_only_tests_amongst_others', {
      'should be run': [ /should_be_run/ ],
      'should also be run': [ /should_also_be_run/ ]
    });
  });

  it('should fail if a test fails', function() {
    return shouldFail(runTestSuite('suite_various_tests'));
  });

  it('should cancel tests that time out', function() {
    return shouldFail(runTestSuite('suite_single_test_that_never_finishes'));
  });

  it('should cancel tests that time out because they are in an infinite loop', function() {
    return shouldFail(runTestSuite('suite_single_test_infinite_loop'));
  });

  it('should send SIGTERM to tests that time out');
  it('should send SIGKILL to tests that don\'t die after SIGTERM');

  it('should run tests sequentially by default', function() {
    var counter = new ParallelismCounter();
    return runTestSuite('suite_various_tests', [counter])
      .then(function() {}, function() {}) // Discard test result
      .then(function() {
        expect(counter).to.have.property('maxParallelism').that.is.equal(1);
      });
  });

  it('should run tests in parallel', function() {
    var counter = new ParallelismCounter();
    return runTestSuite('suite_various_tests', [counter], { parallelism: 3 })
      .then(function() {}, function() {}) // Discard test result
      .then(function() {
        expect(counter).to.have.property('maxParallelism').that.is.equal(3);
      });
  });

  it('should fail when encountering .only tests and disallow_only is set', function() {
    return shouldFail(runTestSuite('suite_single_only_test', [], { disallow_only: true }));
  });
});
