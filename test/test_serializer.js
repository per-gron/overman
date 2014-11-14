'use strict';

var expect = require('chai').expect;
var Serializer = require('../lib/reporter/serializer');

function getTestPathsFromMessages(messages) {
  var paths = [];
  var pathsDict = {};

  messages.forEach(function(message) {
    var path = message[0];
    var pathAsString = JSON.stringify(path);
    if (!(pathAsString in pathsDict)) {
      pathsDict[pathAsString] = true;
      paths.push(path);
    }
  });

  return paths;
}

/**
 * Takes a bunch of test messages and passes them through the serializer.
 * Returns an array the messages that the serializer emitted.
 *
 * For example, the following input:
 *
 * [
 *   [{ file: 'file', path: ['test1'] }, { type: 'begin' }],
 *   [{ file: 'file', path: ['test2'] }, { type: 'begin' }],
 *   [{ file: 'file', path: ['test1'] }, { type: 'finish' }],
 *   [{ file: 'file', path: ['test2'] }, { type: 'finish' }]
 * ]
 *
 * should return
 *
 * [
 *   [{ file: 'file', path: ['test1'] }, { type: 'begin' }],
 *   [{ file: 'file', path: ['test1'] }, { type: 'finish' }],
 *   [{ file: 'file', path: ['test2'] }, { type: 'begin' }],
 *   [{ file: 'file', path: ['test2'] }, { type: 'finish' }]
 * ]
 */
function processMessages(messages, options) {
  var output = [];

  var serializer = new Serializer({
    registerTests: function() {},
    gotMessage: function(testPath, message) {
      output.push([testPath, message]);
    },
    done: function() {}
  });

  serializer.registerTests(getTestPathsFromMessages(messages));
  messages.forEach(function(message) {
    serializer.gotMessage(message[0], message[1]);
  });
  if (!(options || {}).dontSendDone) {
    serializer.done();
  }

  return output;
}

describe('Serializer reporter', function() {
  it('should forward registerTests calls', function(done) {
    var serializer = new Serializer({
      registerTests: function(testPaths) {
        expect(testPaths).to.be.deep.equal([]);
        done();
      }
    });

    serializer.registerTests([]);
  });

  it('should forward done calls', function(done) {
    var serializer = new Serializer({
      registerTests: function() {},
      done: done
    });

    serializer.registerTests([]);
    serializer.done();
  });

  it('should immediately forward the first message it gets', function() {
    var theTestPath = { file: 'file', path: ['test'] };

    expect(processMessages([
      [theTestPath, { type: 'begin' }]
    ], { dontSendDone: true })).to.be.deep.equal([
      [theTestPath, { type: 'begin' }]
    ]);
  });

  it('should emit messages for two parallel tests as if they were run sequentially', function() {
    var test1Path = { file: 'file', path: ['test1'] };
    var test2Path = { file: 'file', path: ['test2'] };

    expect(processMessages([
      [test1Path, { type: 'begin' }],
      [test2Path, { type: 'begin' }],
      [test1Path, { type: 'finish' }],
      [test2Path, { type: 'finish' }],
    ])).to.be.deep.equal([
      [test1Path, { type: 'begin' }],
      [test1Path, { type: 'finish' }],
      [test2Path, { type: 'begin' }],
      [test2Path, { type: 'finish' }],
    ]);
  });

  it('should complain when getting mismatched begins', function() {
    expect(function() {
      processMessages([
        [{ file: 'file', path: ['test'] }, { type: 'begin' }],
      ]);
    }).to.throw(Error);
  });

  it('should complain when getting mismatched pending begins', function() {
    expect(function() {
      processMessages([
        [{ file: 'file', path: ['test'] }, { type: 'begin' }],
        [{ file: 'file', path: ['test2'] }, { type: 'begin' }],
      ]);
    }).to.throw(Error);
  });

  it('should emit begin message for a test as soon as it can', function() {
    var test1Path = { file: 'file', path: ['test1'] };
    var test2Path = { file: 'file', path: ['test2'] };
    var test3Path = { file: 'file', path: ['test3'] };

    expect(processMessages([
      [test1Path, { type: 'begin' }],
      [test2Path, { type: 'begin' }],
      [test3Path, { type: 'begin' }],
      [test1Path, { type: 'finish' }],
    ], { dontSendDone: true })).to.be.deep.equal([
      [test1Path, { type: 'begin' }],
      [test1Path, { type: 'finish' }],
      // Here, the second test should be chosen to begin, even though it doens't know
      // if the second or the third test will actually finish first. The reason this
      // behavior is desirable is that it makes it possible for a sequential run to
      // emit messages continuously, as if it wasn't being serialized at all.
      //
      // This will make it possible for reporters to show output of a test as it runs,
      // and not just after it finishes.
      [test2Path, { type: 'begin' }],
    ]);
  });

  it('should emit multiple finished tests if it can', function() {
    var test1Path = { file: 'file', path: ['test1'] };
    var test2Path = { file: 'file', path: ['test2'] };
    var test3Path = { file: 'file', path: ['test3'] };
    var test4Path = { file: 'file', path: ['test4'] };

    expect(processMessages([
      [test1Path, { type: 'begin' }],
      [test2Path, { type: 'begin' }],
      [test2Path, { type: 'finish' }],
      [test3Path, { type: 'begin' }],
      [test3Path, { type: 'finish' }],
      [test1Path, { type: 'finish' }],
    ], { dontSendDone: true })).to.be.deep.equal([
      [test1Path, { type: 'begin' }],
      [test1Path, { type: 'finish' }],
      [test2Path, { type: 'begin' }],
      [test2Path, { type: 'finish' }],
      [test3Path, { type: 'begin' }],
      [test3Path, { type: 'finish' }],
    ]);
  });

  it('should emit messages for finished tests as soon as possible', function() {
    var test1Path = { file: 'file', path: ['test1'] };
    var test2Path = { file: 'file', path: ['test2'] };
    var test3Path = { file: 'file', path: ['test3'] };

    expect(processMessages([
      [test1Path, { type: 'begin' }],
      [test2Path, { type: 'begin' }],
      [test3Path, { type: 'begin' }],
      [test3Path, { type: 'finish' }],
      [test1Path, { type: 'finish' }],
      [test2Path, { type: 'finish' }],
    ])).to.be.deep.equal([
      [test1Path, { type: 'begin' }],
      [test1Path, { type: 'finish' }],
      [test3Path, { type: 'begin' }],
      [test3Path, { type: 'finish' }],
      [test2Path, { type: 'begin' }],
      [test2Path, { type: 'finish' }],
    ]);
  });

  it('should not serialize tests from within a test file', function() {  // Only suites are serialized, and files don't count as suites
    var test11Path = { file: 'file1', path: ['test1'] };
    var test12Path = { file: 'file1', path: ['test2'] };
    var test2Path = { file: 'file2', path: ['test3'] };

    expect(processMessages([
      [test11Path, { type: 'begin' }],
      [test11Path, { type: 'finish' }],
      [test2Path, { type: 'begin' }],
      [test2Path, { type: 'finish' }],
      [test12Path, { type: 'begin' }],
      [test12Path, { type: 'finish' }],
    ])).to.be.deep.equal([
      [test11Path, { type: 'begin' }],
      [test11Path, { type: 'finish' }],
      [test2Path, { type: 'begin' }],
      [test2Path, { type: 'finish' }],
      [test12Path, { type: 'begin' }],
      [test12Path, { type: 'finish' }],
    ]);
  });

  it('should not pick a test from another suite unless the current suite is done', function() {
    var test11Path = { file: 'file', path: ['suite', 'test1'] };
    var test12Path = { file: 'file', path: ['suite', 'test2'] };
    var test2Path = { file: 'file', path: ['test3'] };

    expect(processMessages([
      [test11Path, { type: 'begin' }],
      [test11Path, { type: 'finish' }],
      [test2Path, { type: 'begin' }],
      [test12Path, { type: 'begin' }],
    ], { dontSendDone: true })).to.be.deep.equal([
      [test11Path, { type: 'begin' }],
      [test11Path, { type: 'finish' }],
      [test12Path, { type: 'begin' }],
    ]);
  });

  it('should suppress messages from a different suite until the current one is done', function() {
    var test11Path = { file: 'file', path: ['suite', 'test1'] };
    var test12Path = { file: 'file', path: ['suite', 'test2'] };
    var test2Path = { file: 'file', path: ['test3'] };

    expect(processMessages([
      [test11Path, { type: 'begin' }],
      [test2Path, { type: 'begin' }],
      [test2Path, { type: 'finish' }],
      [test12Path, { type: 'begin' }],
      [test11Path, { type: 'finish' }],
      [test12Path, { type: 'finish' }],
    ])).to.be.deep.equal([
      [test11Path, { type: 'begin' }],
      [test11Path, { type: 'finish' }],
      [test12Path, { type: 'begin' }],
      [test12Path, { type: 'finish' }],
      [test2Path, { type: 'begin' }],
      [test2Path, { type: 'finish' }],
    ]);
  });

  it('should suppress messages from a suite until all tests in a subsuite is done', function() {
    var test11Path = { file: 'file', path: ['suite', 'subsuite', 'test1'] };
    var test12Path = { file: 'file', path: ['suite', 'subsuite', 'test2'] };
    var test2Path = { file: 'file', path: ['suite', 'test3'] };

    expect(processMessages([
      [test11Path, { type: 'begin' }],
      [test2Path, { type: 'begin' }],
      [test2Path, { type: 'finish' }],
      [test12Path, { type: 'begin' }],
      [test11Path, { type: 'finish' }],
      [test12Path, { type: 'finish' }],
    ])).to.be.deep.equal([
      [test11Path, { type: 'begin' }],
      [test11Path, { type: 'finish' }],
      [test12Path, { type: 'begin' }],
      [test12Path, { type: 'finish' }],
      [test2Path, { type: 'begin' }],
      [test2Path, { type: 'finish' }],
    ]);
  });

  it('should allow tests in subsuites to run while there are pending tests in that suite', function() {
    var test11Path = { file: 'file', path: ['suite', 'test1'] };
    var test12Path = { file: 'file', path: ['suite', 'subsuite', 'test2'] };
    var test2Path = { file: 'file', path: ['suite', 'test3'] };

    expect(processMessages([
      [test11Path, { type: 'begin' }],
      [test12Path, { type: 'begin' }],
      [test11Path, { type: 'finish' }],
      [test2Path, { type: 'begin' }],
      [test2Path, { type: 'finish' }],
      [test12Path, { type: 'finish' }],
    ])).to.be.deep.equal([
      [test11Path, { type: 'begin' }],
      [test11Path, { type: 'finish' }],
      [test12Path, { type: 'begin' }],
      [test12Path, { type: 'finish' }],
      [test2Path, { type: 'begin' }],
      [test2Path, { type: 'finish' }],
    ]);
  });
});
