var fs = require('fs');
var path = require('path');
var bdd = require('./lib/interface/bdd');
var suiterunner = require('./lib/suite_runner');

var suiteFiles = fs.readdirSync('test')
  .filter(function(filename) { return filename.match(/^test_/); })
  .map(function(filename) { return path.join('test', filename) });

suiterunner({
    suites: suiteFiles,
    interface: './lib/interface/bdd',
    reporters: [],
    parallelism: 2,
    timeout: 1000
  })
  .then(function() {}, function() { process.exit(1); });
