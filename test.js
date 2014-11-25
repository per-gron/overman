var fs = require('fs');
var path = require('path');
var suiterunner = require('./lib/suite_runner');
var PipeReporter = require('./lib/reporter/pipe');
var SpecProgress = require('./lib/reporter/spec_progress');
var Summary = require('./lib/reporter/summary');

var suiteFiles = fs.readdirSync('test')
  .filter(function(filename) { return filename.match(/^test_/); })
  .map(function(filename) { return path.join('test', filename) });

suiterunner({
    suites: suiteFiles,
    interface: './lib/interface/bdd_mocha',
    reporters: [
      new PipeReporter(process),
      new SpecProgress(process.stdout),
      new Summary(process.stdout)
    ],
    parallelism: 8,
    timeout: 10000
  })
  .then(function() {}, function(err) { process.exit(1); });
