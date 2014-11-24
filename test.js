var fs = require('fs');
var path = require('path');
var suiterunner = require('./lib/suite_runner');
var PipeReporter = require('./lib/reporter/pipe');
var SpecProgress = require('./lib/reporter/spec_progress');

var suiteFiles = fs.readdirSync('test')
  .filter(function(filename) { return filename.match(/^test_/); })
  .map(function(filename) { return path.join('test', filename) });

suiterunner({
    suites: suiteFiles,
    interface: './lib/interface/bdd_mocha',
    reporters: [new PipeReporter(process), new SpecProgress(process.stdout)],
    parallelism: 8,
    timeout: 10000
  })
  .then(function() {}, function(err) { console.log(err.stack); process.exit(1); });
