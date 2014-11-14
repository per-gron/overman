/**
 * This file is a node module that exposes functionality to list the tests
 * that a given test suite has. It uses the bin/list_suite script to do this.
 */

var _ = require('lodash');
var childProcess = require('child_process');
var when = require('when');

function streamToString(stream) {
  return when.promise(function(resolve) {
    var string = '';
    stream.on('data', function(data) {
      string += data;
    });
    stream.on('end', function() {
      resolve(string);
    })
  });
}

function listTestsOfFile(testInterfacePath, suite) {
  var child = childProcess.fork(
    __dirname + '/bin/list_suite',
    [testInterfacePath, suite],
    { silent: true });

  return streamToString(child.stdout)
    .then(function(string) {
      return JSON.parse(string);
    });
}
exports.listTestsOfFile = listTestsOfFile;

function listTestsOfFiles(testInterfacePath, suites) {
  return when.all(suites.map(listTestsOfFile.bind(this, testInterfacePath)))
    .then(function(suitesTests) {
      return _.flatten(suitesTests, true);
    });
}
exports.listTestsOfFiles = listTestsOfFiles;