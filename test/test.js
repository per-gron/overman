var bdd = require('../lib/interface/bdd');
var suiterunner = require('../lib/suite_runner');

// console.log(bdd('./test/test_echo.js'));

suiterunner({
  suites: ['./test_suite.js'],
  interface: '../lib/interface/bdd',
  reporters: [],
  parallelism: 2
});
