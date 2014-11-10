var fs = require('fs');
var path = require('path');
var suiterunner = require('./lib/suite_runner');

var suiteFiles = fs.readdirSync('test')
  .filter(function(filename) { return filename.match(/^test_/); })
  .map(function(filename) { return path.join('test', filename) });

suiterunner({
    suites: suiteFiles,
    interface: './lib/interface/bdd_mocha',
    reporters: [],
    parallelism: 2,
    timeout: 1000
  })
  .then(function() {}, function() { process.exit(1); });
